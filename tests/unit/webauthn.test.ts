import { describe, it, expect } from "vitest";
import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";
import {
  b64uDecode,
  b64uEncode,
  buildAuthenticationChallenge,
  buildRegistrationChallenge,
  cborDecode,
  coseToSpkiPem,
  newChallenge,
  parseAuthData,
  parseClientDataJSON,
  verifyAuthentication,
  verifyRegistration,
} from "@/modules/two-factor/webauthn";

// ---------------- CBOR encoder (test-only fixture builder) ----------------

function cborUint(n: number): Buffer {
  if (n < 24) return Buffer.from([n]);
  if (n < 256) return Buffer.from([24, n]);
  if (n < 65536) {
    const b = Buffer.alloc(3);
    b.writeUInt8(25, 0);
    b.writeUInt16BE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b.writeUInt8(26, 0);
  b.writeUInt32BE(n, 1);
  return b;
}

function cborHead(major: number, n: number): Buffer {
  const u = cborUint(n);
  u[0] = (major << 5) | (u[0]! & 0x1f);
  return u;
}

function cborInt(n: number): Buffer {
  if (n >= 0) return cborHead(0, n);
  return cborHead(1, -n - 1);
}

function cborBytes(buf: Buffer): Buffer {
  return Buffer.concat([cborHead(2, buf.length), buf]);
}

function cborText(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([cborHead(3, b.length), b]);
}

function cborMap(entries: [Buffer, Buffer][]): Buffer {
  const head = cborHead(5, entries.length);
  return Buffer.concat([head, ...entries.flatMap(([k, v]) => [k, v])]);
}

// ---------------- WebAuthn fixture builder ----------------

function buildAuthData(opts: {
  rpId: string;
  flags: number;
  signCount: number;
  credentialId?: Buffer;
  cosePublicKey?: Buffer;
}): Buffer {
  const rpIdHash = createHash("sha256").update(opts.rpId).digest();
  const flags = Buffer.from([opts.flags]);
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(opts.signCount, 0);
  if (opts.credentialId && opts.cosePublicKey) {
    const aaguid = Buffer.alloc(16); // zeros
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(opts.credentialId.length, 0);
    return Buffer.concat([rpIdHash, flags, counter, aaguid, credIdLen, opts.credentialId, opts.cosePublicKey]);
  }
  return Buffer.concat([rpIdHash, flags, counter]);
}

function rsaCoseKey(publicKey: KeyObject): Buffer {
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
  const n = b64uDecode(jwk.n);
  const e = b64uDecode(jwk.e);
  return cborMap([
    [cborInt(1), cborInt(3)], // kty: RSA
    [cborInt(3), cborInt(-257)], // alg: RS256
    [cborInt(-1), cborBytes(n)],
    [cborInt(-2), cborBytes(e)],
  ]);
}

function ecCoseKey(publicKey: KeyObject): Buffer {
  // Use raw uncompressed point form via JWK x/y
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string; crv: string };
  if (jwk.crv !== "P-256") throw new Error("expected P-256");
  const x = b64uDecode(jwk.x);
  const y = b64uDecode(jwk.y);
  return cborMap([
    [cborInt(1), cborInt(2)], // kty: EC2
    [cborInt(3), cborInt(-7)], // alg: ES256
    [cborInt(-1), cborInt(1)], // crv: P-256
    [cborInt(-2), cborBytes(x)],
    [cborInt(-3), cborBytes(y)],
  ]);
}

function buildAttestationObject(authData: Buffer): Buffer {
  return cborMap([
    [cborText("fmt"), cborText("none")],
    [cborText("attStmt"), cborMap([])],
    [cborText("authData"), cborBytes(authData)],
  ]);
}

// ---------------- Tests ----------------

describe("webauthn — base64url + challenge helpers", () => {
  it("base64url round-trips arbitrary bytes", () => {
    const buf = Buffer.from([0xff, 0x00, 0xab, 0x10, 0x7e]);
    expect(b64uDecode(b64uEncode(buf)).equals(buf)).toBe(true);
  });

  it("newChallenge returns 32 random bytes encoded", () => {
    const c = newChallenge();
    expect(b64uDecode(c).length).toBe(32);
  });

  it("buildRegistrationChallenge advertises ES256 + RS256", () => {
    const ch = buildRegistrationChallenge({
      rpId: "example.com",
      rpName: "Example",
      userId: "user-1",
      userName: "alice@example.com",
    });
    expect(ch.pubKeyCredParams.map((p) => p.alg).sort()).toEqual([-257, -7]);
    expect(b64uDecode(ch.challenge).length).toBe(32);
  });

  it("buildAuthenticationChallenge uses default 60s timeout", () => {
    const ch = buildAuthenticationChallenge({ rpId: "example.com" });
    expect(ch.timeoutMs).toBe(60_000);
  });
});

describe("webauthn — clientDataJSON", () => {
  it("parses + asserts matching fields", () => {
    const json = { type: "webauthn.create", challenge: "abc", origin: "https://example.com" };
    const enc = b64uEncode(Buffer.from(JSON.stringify(json), "utf8"));
    const cd = parseClientDataJSON(enc);
    expect(cd.type).toBe("webauthn.create");
  });

  it("throws on origin mismatch via verifyRegistration", () => {
    const cd = b64uEncode(
      Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: "c1", origin: "https://attacker" })),
    );
    expect(() =>
      verifyRegistration({
        expectedChallenge: "c1",
        expectedOrigin: "https://example.com",
        expectedRpId: "example.com",
        clientDataJSON: cd,
        attestationObject: b64uEncode(Buffer.from([0])),
      }),
    ).toThrow(/Origin mismatch/);
  });
});

describe("webauthn — CBOR + authData parsing", () => {
  it("decodes a small CBOR map", () => {
    const enc = cborMap([[cborText("k"), cborInt(42)]]);
    const out = cborDecode(enc) as Map<unknown, unknown>;
    expect(out.get("k")).toBe(42);
  });

  it("parseAuthData reads rpIdHash + flags + counter", () => {
    const ad = buildAuthData({ rpId: "example.com", flags: 0x01, signCount: 5 });
    const parsed = parseAuthData(ad);
    expect(parsed.flags).toBe(0x01);
    expect(parsed.signCount).toBe(5);
    expect(parsed.credentialId).toBeUndefined();
  });

  it("parseAuthData extracts attested credential data when flag set", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cose = rsaCoseKey(publicKey);
    const credId = randomBytes(16);
    const ad = buildAuthData({
      rpId: "example.com",
      flags: 0x01 | 0x40,
      signCount: 0,
      credentialId: credId,
      cosePublicKey: cose,
    });
    const parsed = parseAuthData(ad);
    expect(parsed.credentialId?.equals(credId)).toBe(true);
    expect(parsed.credentialPublicKeyCose).toBeInstanceOf(Map);
  });
});

describe("webauthn — coseToSpkiPem", () => {
  it("converts an RSA COSE key to SPKI PEM", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cose = cborDecode(rsaCoseKey(publicKey)) as Map<unknown, unknown>;
    const { pem, alg } = coseToSpkiPem(cose);
    expect(alg).toBe(-257);
    expect(pem).toMatch(/-----BEGIN PUBLIC KEY-----/);
  });

  it("converts an EC P-256 COSE key to SPKI PEM", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const cose = cborDecode(ecCoseKey(publicKey)) as Map<unknown, unknown>;
    const { pem, alg } = coseToSpkiPem(cose);
    expect(alg).toBe(-7);
    expect(pem).toMatch(/-----BEGIN PUBLIC KEY-----/);
  });
});

describe("webauthn — verifyRegistration round-trip (RSA)", () => {
  it("accepts a freshly minted attestationObject", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cose = rsaCoseKey(publicKey);
    const credId = randomBytes(16);
    const authData = buildAuthData({
      rpId: "example.com",
      flags: 0x01 | 0x40,
      signCount: 0,
      credentialId: credId,
      cosePublicKey: cose,
    });
    const attObj = buildAttestationObject(authData);
    const challenge = newChallenge();
    const cd = b64uEncode(
      Buffer.from(
        JSON.stringify({ type: "webauthn.create", challenge, origin: "https://example.com" }),
      ),
    );
    const result = verifyRegistration({
      expectedChallenge: challenge,
      expectedOrigin: "https://example.com",
      expectedRpId: "example.com",
      clientDataJSON: cd,
      attestationObject: b64uEncode(attObj),
    });
    expect(result.fmt).toBe("none");
    expect(result.alg).toBe(-257);
    expect(result.credentialId).toBe(b64uEncode(credId));
    expect(result.publicKeyPem).toMatch(/PUBLIC KEY/);
  });
});

describe("webauthn — verifyAuthentication round-trip (RSA)", () => {
  it("verifies an RS256 assertion produced by node:crypto", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cose = rsaCoseKey(publicKey);
    const credId = randomBytes(16);
    // Register first to obtain the SPKI PEM via the production path.
    const regAuthData = buildAuthData({
      rpId: "example.com",
      flags: 0x01 | 0x40,
      signCount: 0,
      credentialId: credId,
      cosePublicKey: cose,
    });
    const challenge = newChallenge();
    const regCd = b64uEncode(
      Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin: "https://example.com" })),
    );
    const reg = verifyRegistration({
      expectedChallenge: challenge,
      expectedOrigin: "https://example.com",
      expectedRpId: "example.com",
      clientDataJSON: regCd,
      attestationObject: b64uEncode(buildAttestationObject(regAuthData)),
    });

    // Now build & sign an authentication assertion.
    const authChallenge = newChallenge();
    const authCdBuf = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge: authChallenge, origin: "https://example.com" }),
    );
    const authData = buildAuthData({ rpId: "example.com", flags: 0x01, signCount: 7 });
    const clientDataHash = createHash("sha256").update(authCdBuf).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const signer = createSign("sha256");
    signer.update(signedData);
    const sig = signer.sign(privateKey);

    const ok = verifyAuthentication({
      expectedChallenge: authChallenge,
      expectedOrigin: "https://example.com",
      expectedRpId: "example.com",
      storedPublicKeyPem: reg.publicKeyPem,
      storedAlg: reg.alg,
      storedSignCount: 0,
      clientDataJSON: b64uEncode(authCdBuf),
      authenticatorData: b64uEncode(authData),
      signature: b64uEncode(sig),
    });
    expect(ok.verified).toBe(true);
    expect(ok.newSignCount).toBe(7);
    expect(ok.signCountIncreased).toBe(true);
  });

  it("rejects when signCount does not advance", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const cose = rsaCoseKey(publicKey);
    const credId = randomBytes(16);
    const regAuthData = buildAuthData({
      rpId: "example.com",
      flags: 0x01 | 0x40,
      signCount: 0,
      credentialId: credId,
      cosePublicKey: cose,
    });
    const ch = newChallenge();
    const reg = verifyRegistration({
      expectedChallenge: ch,
      expectedOrigin: "https://example.com",
      expectedRpId: "example.com",
      clientDataJSON: b64uEncode(
        Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: ch, origin: "https://example.com" })),
      ),
      attestationObject: b64uEncode(buildAttestationObject(regAuthData)),
    });

    const authChallenge = newChallenge();
    const authCdBuf = Buffer.from(
      JSON.stringify({ type: "webauthn.get", challenge: authChallenge, origin: "https://example.com" }),
    );
    const authData = buildAuthData({ rpId: "example.com", flags: 0x01, signCount: 3 });
    const signer = createSign("sha256");
    signer.update(Buffer.concat([authData, createHash("sha256").update(authCdBuf).digest()]));
    const sig = signer.sign(privateKey);

    expect(() =>
      verifyAuthentication({
        expectedChallenge: authChallenge,
        expectedOrigin: "https://example.com",
        expectedRpId: "example.com",
        storedPublicKeyPem: reg.publicKeyPem,
        storedAlg: reg.alg,
        storedSignCount: 5, // stored higher than new
        clientDataJSON: b64uEncode(authCdBuf),
        authenticatorData: b64uEncode(authData),
        signature: b64uEncode(sig),
      }),
    ).toThrow(/signCount/);
  });
});
