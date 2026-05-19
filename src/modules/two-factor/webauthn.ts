import { createHash, createPublicKey, createVerify, randomBytes } from "node:crypto";

/**
 * Zero-dep WebAuthn (passkey) engine.
 *
 * Scope:
 * - Generate registration / authentication challenges
 * - Verify clientDataJSON (origin, type, challenge)
 * - Decode the attestationObject (CBOR) for fmt="none" registrations
 * - Extract the credential public key (COSE_Key) and convert to SPKI for storage
 * - Verify ES256 (alg=-7) and RS256 (alg=-257) authentication assertions
 *
 * No external libraries. No browser globals. Pure Node `crypto` only.
 *
 * Persistence is intentionally decoupled — callers store the returned credential
 * record (publicKeyPem + credentialId + signCount) however they like.
 */

// ---------- Public types ----------

export type CoseAlg = -7 | -257; // ES256 | RS256

export interface RegistrationChallenge {
  challenge: string; // base64url
  rpId: string;
  rpName: string;
  userId: string; // base64url of stable internal id
  userName: string;
  userDisplayName: string;
  pubKeyCredParams: { type: "public-key"; alg: CoseAlg }[];
  timeoutMs: number;
}

export interface AuthenticationChallenge {
  challenge: string; // base64url
  rpId: string;
  allowCredentialIds: string[]; // base64url
  timeoutMs: number;
}

export interface RegistrationVerificationInput {
  expectedChallenge: string; // base64url
  expectedOrigin: string;
  expectedRpId: string;
  clientDataJSON: string; // base64url
  attestationObject: string; // base64url
}

export interface VerifiedCredential {
  credentialId: string; // base64url
  publicKeyPem: string; // SPKI PEM
  alg: CoseAlg;
  signCount: number;
  aaguid: string; // hex
  fmt: string;
}

export interface AuthenticationVerificationInput {
  expectedChallenge: string; // base64url
  expectedOrigin: string;
  expectedRpId: string;
  storedPublicKeyPem: string;
  storedAlg: CoseAlg;
  storedSignCount: number;
  clientDataJSON: string; // base64url
  authenticatorData: string; // base64url
  signature: string; // base64url
}

export interface AuthenticationResult {
  verified: true;
  newSignCount: number;
  signCountIncreased: boolean;
}

// ---------- base64url ----------

export function b64uEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function b64uDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

// ---------- Challenge generation ----------

export function newChallenge(bytes = 32): string {
  return b64uEncode(randomBytes(bytes));
}

export function buildRegistrationChallenge(opts: {
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName?: string;
  timeoutMs?: number;
}): RegistrationChallenge {
  return {
    challenge: newChallenge(),
    rpId: opts.rpId,
    rpName: opts.rpName,
    userId: b64uEncode(Buffer.from(opts.userId, "utf8")),
    userName: opts.userName,
    userDisplayName: opts.userDisplayName ?? opts.userName,
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeoutMs: opts.timeoutMs ?? 60_000,
  };
}

export function buildAuthenticationChallenge(opts: {
  rpId: string;
  allowCredentialIds?: string[];
  timeoutMs?: number;
}): AuthenticationChallenge {
  return {
    challenge: newChallenge(),
    rpId: opts.rpId,
    allowCredentialIds: opts.allowCredentialIds ?? [],
    timeoutMs: opts.timeoutMs ?? 60_000,
  };
}

// ---------- clientDataJSON ----------

export interface ClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

export function parseClientDataJSON(b64u: string): ClientData {
  const json = b64uDecode(b64u).toString("utf8");
  const parsed = JSON.parse(json) as ClientData;
  if (typeof parsed?.type !== "string" || typeof parsed?.challenge !== "string" || typeof parsed?.origin !== "string") {
    throw new Error("Malformed clientDataJSON");
  }
  return parsed;
}

export function assertClientData(
  cd: ClientData,
  expected: { type: "webauthn.create" | "webauthn.get"; challenge: string; origin: string },
): void {
  if (cd.type !== expected.type) throw new Error(`Unexpected clientData.type: ${cd.type}`);
  if (cd.challenge !== expected.challenge) throw new Error("Challenge mismatch");
  if (cd.origin !== expected.origin) throw new Error(`Origin mismatch: ${cd.origin}`);
}

// ---------- Minimal CBOR decoder (subset used by WebAuthn) ----------
// Supports: unsigned/negative ints, byte strings, text strings, arrays, maps,
// simple values (false/true/null/undefined). Sufficient for attestationObject
// + COSE_Key parsing.

interface CborState { buf: Buffer; off: number }

function readUInt(s: CborState, info: number): number | bigint {
  if (info < 24) return info;
  if (info === 24) { const v = s.buf.readUInt8(s.off); s.off += 1; return v; }
  if (info === 25) { const v = s.buf.readUInt16BE(s.off); s.off += 2; return v; }
  if (info === 26) { const v = s.buf.readUInt32BE(s.off); s.off += 4; return v; }
  if (info === 27) {
    const hi = s.buf.readUInt32BE(s.off); const lo = s.buf.readUInt32BE(s.off + 4); s.off += 8;
    const big = (BigInt(hi) << 32n) | BigInt(lo);
    return big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big;
  }
  throw new Error(`Unsupported CBOR additional info: ${info}`);
}

function decode(s: CborState): unknown {
  if (s.off >= s.buf.length) throw new Error("CBOR: unexpected end");
  const ib = s.buf.readUInt8(s.off); s.off += 1;
  const major = ib >> 5;
  const info = ib & 0x1f;
  const v = readUInt(s, info);
  switch (major) {
    case 0: return v;
    case 1: return typeof v === "bigint" ? -1n - v : -1 - (v as number);
    case 2: {
      const len = Number(v);
      const out = s.buf.subarray(s.off, s.off + len);
      s.off += len;
      return out;
    }
    case 3: {
      const len = Number(v);
      const out = s.buf.subarray(s.off, s.off + len).toString("utf8");
      s.off += len;
      return out;
    }
    case 4: {
      const len = Number(v);
      const arr = new Array<unknown>(len);
      for (let i = 0; i < len; i += 1) arr[i] = decode(s);
      return arr;
    }
    case 5: {
      const len = Number(v);
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < len; i += 1) {
        const k = decode(s);
        map.set(k, decode(s));
      }
      return map;
    }
    case 7: {
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22) return null;
      if (info === 23) return undefined;
      throw new Error(`Unsupported CBOR simple value: ${info}`);
    }
    default:
      throw new Error(`Unsupported CBOR major type: ${major}`);
  }
}

export function cborDecode(buf: Buffer): unknown {
  const s: CborState = { buf, off: 0 };
  return decode(s);
}

// ---------- authenticatorData parsing ----------

export interface AuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid?: Buffer;
  credentialId?: Buffer;
  credentialPublicKeyCose?: Map<unknown, unknown>;
}

export function parseAuthData(buf: Buffer): AuthData {
  if (buf.length < 37) throw new Error("authenticatorData too short");
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf.readUInt8(32);
  const signCount = buf.readUInt32BE(33);
  const out: AuthData = { rpIdHash, flags, signCount };
  if (flags & 0x40) {
    // attestedCredentialData present
    if (buf.length < 55) throw new Error("attestedCredentialData missing");
    const aaguid = buf.subarray(37, 53);
    const credIdLen = buf.readUInt16BE(53);
    const credId = buf.subarray(55, 55 + credIdLen);
    const rest = buf.subarray(55 + credIdLen);
    const cose = cborDecode(rest);
    if (!(cose instanceof Map)) throw new Error("COSE key not a map");
    out.aaguid = aaguid;
    out.credentialId = credId;
    out.credentialPublicKeyCose = cose;
  }
  return out;
}

// ---------- COSE_Key → SPKI PEM ----------

function derLen(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  if (n < 0x100) return Buffer.from([0x81, n]);
  return Buffer.from([0x82, (n >> 8) & 0xff, n & 0xff]);
}

function derSeq(...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), derLen(body.length), body]);
}

function derInt(buf: Buffer): Buffer {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i += 1;
  let v = buf.subarray(i);
  if (v[0]! & 0x80) v = Buffer.concat([Buffer.from([0x00]), v]);
  return Buffer.concat([Buffer.from([0x02]), derLen(v.length), v]);
}

function derBitString(buf: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from([0x00]), buf]);
  return Buffer.concat([Buffer.from([0x03]), derLen(body.length), body]);
}

function derOid(parts: number[]): Buffer {
  const bytes: number[] = [parts[0]! * 40 + parts[1]!];
  for (let i = 2; i < parts.length; i += 1) {
    let v = parts[i]!;
    const stack: number[] = [v & 0x7f];
    v >>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>= 7; }
    bytes.push(...stack);
  }
  return Buffer.concat([Buffer.from([0x06]), derLen(bytes.length), Buffer.from(bytes)]);
}

const NULL_DER = Buffer.from([0x05, 0x00]);

const OID_EC_PUBLIC_KEY = derOid([1, 2, 840, 10045, 2, 1]);
const OID_P256 = derOid([1, 2, 840, 10045, 3, 1, 7]);
const OID_RSA = derOid([1, 2, 840, 113549, 1, 1, 1]);

function pemWrap(label: string, der: Buffer): string {
  const b64 = der.toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

export function coseToSpkiPem(cose: Map<unknown, unknown>): { pem: string; alg: CoseAlg } {
  const kty = Number(cose.get(1));
  const alg = Number(cose.get(3)) as CoseAlg;
  if (kty === 2 && alg === -7) {
    // EC P-256
    const x = Buffer.from(cose.get(-2) as Buffer);
    const y = Buffer.from(cose.get(-3) as Buffer);
    if (x.length !== 32 || y.length !== 32) throw new Error("Invalid EC2 coords");
    const point = Buffer.concat([Buffer.from([0x04]), x, y]);
    const algId = derSeq(OID_EC_PUBLIC_KEY, OID_P256);
    const spki = derSeq(algId, derBitString(point));
    return { pem: pemWrap("PUBLIC KEY", spki), alg };
  }
  if (kty === 3 && alg === -257) {
    // RSA
    const n = Buffer.from(cose.get(-1) as Buffer);
    const e = Buffer.from(cose.get(-2) as Buffer);
    const rsaPub = derSeq(derInt(n), derInt(e));
    const algId = derSeq(OID_RSA, NULL_DER);
    const spki = derSeq(algId, derBitString(rsaPub));
    return { pem: pemWrap("PUBLIC KEY", spki), alg };
  }
  throw new Error(`Unsupported COSE_Key (kty=${kty}, alg=${alg})`);
}

// ---------- ECDSA raw → DER signature ----------

function ecdsaRawToDer(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error("Expected 64-byte raw ECDSA signature");
  const r = derInt(raw.subarray(0, 32));
  const s = derInt(raw.subarray(32, 64));
  return derSeq(r, s);
}

// ---------- Registration verification ----------

export function verifyRegistration(input: RegistrationVerificationInput): VerifiedCredential {
  const cd = parseClientDataJSON(input.clientDataJSON);
  assertClientData(cd, {
    type: "webauthn.create",
    challenge: input.expectedChallenge,
    origin: input.expectedOrigin,
  });

  const att = cborDecode(b64uDecode(input.attestationObject));
  if (!(att instanceof Map)) throw new Error("attestationObject not a CBOR map");
  const fmt = String(att.get("fmt"));
  const authDataBuf = att.get("authData") as Buffer | undefined;
  if (!authDataBuf) throw new Error("attestationObject missing authData");

  const authData = parseAuthData(Buffer.from(authDataBuf));
  const expectedRpIdHash = createHash("sha256").update(input.expectedRpId).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) throw new Error("rpIdHash mismatch");
  if (!(authData.flags & 0x01)) throw new Error("User Presence flag not set");
  if (!authData.credentialId || !authData.credentialPublicKeyCose) {
    throw new Error("Attested credential data missing");
  }

  // Only "none" attestation is verified deeply. Other formats are accepted but
  // their attestation statements are not validated (callers requiring strong
  // attestation should reject non-"none" before storing the credential).
  if (fmt !== "none" && fmt !== "packed") {
    // Allow but mark — most first-party passkeys use "none".
  }

  const { pem, alg } = coseToSpkiPem(authData.credentialPublicKeyCose);
  return {
    credentialId: b64uEncode(authData.credentialId),
    publicKeyPem: pem,
    alg,
    signCount: authData.signCount,
    aaguid: authData.aaguid?.toString("hex") ?? "",
    fmt,
  };
}

// ---------- Authentication verification ----------

export function verifyAuthentication(input: AuthenticationVerificationInput): AuthenticationResult {
  const cd = parseClientDataJSON(input.clientDataJSON);
  assertClientData(cd, {
    type: "webauthn.get",
    challenge: input.expectedChallenge,
    origin: input.expectedOrigin,
  });

  const authDataBuf = b64uDecode(input.authenticatorData);
  const authData = parseAuthData(authDataBuf);
  const expectedRpIdHash = createHash("sha256").update(input.expectedRpId).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) throw new Error("rpIdHash mismatch");
  if (!(authData.flags & 0x01)) throw new Error("User Presence flag not set");

  const clientDataHash = createHash("sha256").update(b64uDecode(input.clientDataJSON)).digest();
  const signedData = Buffer.concat([authDataBuf, clientDataHash]);
  const sigRaw = b64uDecode(input.signature);

  const key = createPublicKey(input.storedPublicKeyPem);
  let ok = false;
  if (input.storedAlg === -7) {
    const der = sigRaw.length === 64 ? ecdsaRawToDer(sigRaw) : sigRaw;
    const v = createVerify("sha256");
    v.update(signedData);
    ok = v.verify(key, der);
  } else if (input.storedAlg === -257) {
    const v = createVerify("sha256");
    v.update(signedData);
    ok = v.verify(key, sigRaw);
  } else {
    throw new Error(`Unsupported alg: ${input.storedAlg}`);
  }
  if (!ok) throw new Error("Signature verification failed");

  const newSignCount = authData.signCount;
  // Per spec, if both stored and new are 0 the authenticator doesn't track
  // counters. Otherwise newSignCount must strictly increase.
  if (input.storedSignCount > 0 || newSignCount > 0) {
    if (newSignCount <= input.storedSignCount) {
      throw new Error("signCount did not increase — possible cloned authenticator");
    }
  }
  return {
    verified: true,
    newSignCount,
    signCountIncreased: newSignCount > input.storedSignCount,
  };
}
