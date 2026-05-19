import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";

/**
 * Zero-dep OpenID Connect issuer.
 *
 * Surface:
 * - `generateRsaKey`      — produce an RS256 signing key + JWK fingerprint kid
 * - `signIdToken`         — RS256 JWT signing with standard OIDC claims
 * - `verifyIdToken`       — JWT verify + claim assertions
 * - `buildJwks`           — JWKS document (public key only) for /.well-known/jwks.json
 * - `buildDiscoveryDoc`   — /.well-known/openid-configuration
 * - `newAuthorizationCode` / `validateAuthorizationCode` — opaque short-lived codes (in-memory store)
 * - `pkceVerify`          — RFC 7636 S256 PKCE check
 *
 * No external libraries. Pure Node `crypto`.
 */

// ---------- base64url ----------

function b64u(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64uDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function b64uJson(obj: unknown): string {
  return b64u(Buffer.from(JSON.stringify(obj), "utf8"));
}

// ---------- RSA keypair + kid ----------

export interface OidcSigningKey {
  kid: string;
  privateKeyPem: string;
  publicKeyPem: string;
  alg: "RS256";
}

export interface RsaJwk {
  kty: "RSA";
  n: string;
  e: string;
  kid: string;
  alg: "RS256";
  use: "sig";
}

function rsaPublicComponents(key: KeyObject): { n: Buffer; e: Buffer } {
  const jwk = key.export({ format: "jwk" }) as { n?: string; e?: string };
  if (!jwk.n || !jwk.e) throw new Error("Not an RSA public key");
  return { n: b64uDecode(jwk.n), e: b64uDecode(jwk.e) };
}

export function rsaJwk(publicKeyPem: string, kid: string): RsaJwk {
  const key = createPublicKey(publicKeyPem);
  const { n, e } = rsaPublicComponents(key);
  return { kty: "RSA", n: b64u(n), e: b64u(e), kid, alg: "RS256", use: "sig" };
}

/**
 * Compute a stable `kid` from the public key bytes (sha256 → base64url, first 16 bytes).
 * Same input → same kid, so JWKS rotation is deterministic.
 */
export function thumbprintKid(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem);
  const { n, e } = rsaPublicComponents(key);
  // RFC 7638 JWK thumbprint: canonical {e,kty,n}
  const canonical = JSON.stringify({ e: b64u(e), kty: "RSA", n: b64u(n) });
  return b64u(createHash("sha256").update(canonical).digest()).slice(0, 22);
}

export function generateRsaKey(modulusLength = 2048): OidcSigningKey {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength });
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const kid = thumbprintKid(publicKeyPem);
  return { kid, privateKeyPem, publicKeyPem, alg: "RS256" };
}

// ---------- JWT (RS256) ----------

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number; // seconds
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  [k: string]: unknown;
}

export function signIdToken(claims: IdTokenClaims, key: OidcSigningKey): string {
  const header = { alg: key.alg, typ: "JWT", kid: key.kid };
  const headerB = b64uJson(header);
  const payloadB = b64uJson(claims);
  const signingInput = `${headerB}.${payloadB}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput, "utf8");
  const sig = signer.sign(createPrivateKey(key.privateKeyPem));
  return `${signingInput}.${b64u(sig)}`;
}

export interface JwtVerifyOptions {
  issuer: string;
  audience: string | string[];
  now?: Date;
  clockSkewSeconds?: number;
  nonce?: string;
}

export function verifyIdToken(jwt: string, publicKeyPem: string, opts: JwtVerifyOptions): IdTokenClaims {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const [h, p, s] = parts as [string, string, string];
  const header = JSON.parse(b64uDecode(h).toString("utf8")) as { alg?: string; typ?: string; kid?: string };
  if (header.alg !== "RS256") throw new Error(`Unsupported alg: ${header.alg}`);
  const sigBuf = b64uDecode(s);
  const v = createVerify("RSA-SHA256");
  v.update(`${h}.${p}`, "utf8");
  if (!v.verify(createPublicKey(publicKeyPem), sigBuf)) throw new Error("Bad signature");

  const claims = JSON.parse(b64uDecode(p).toString("utf8")) as IdTokenClaims;
  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const skew = opts.clockSkewSeconds ?? 30;
  if (claims.iss !== opts.issuer) throw new Error(`iss mismatch: ${claims.iss}`);
  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const expectedAud = Array.isArray(opts.audience) ? opts.audience : [opts.audience];
  if (!expectedAud.some((a) => audList.includes(a))) throw new Error("aud mismatch");
  if (typeof claims.exp !== "number" || now > claims.exp + skew) throw new Error("Token expired");
  if (typeof claims.iat !== "number" || claims.iat > now + skew) throw new Error("iat in future");
  if (opts.nonce && claims.nonce !== opts.nonce) throw new Error("nonce mismatch");
  return claims;
}

// ---------- JWKS + Discovery ----------

export function buildJwks(keys: { kid: string; publicKeyPem: string }[]): { keys: RsaJwk[] } {
  return { keys: keys.map((k) => rsaJwk(k.publicKeyPem, k.kid)) };
}

export interface DiscoveryDocOptions {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri: string;
  endSessionEndpoint?: string;
}

export function buildDiscoveryDoc(opts: DiscoveryDocOptions): Record<string, unknown> {
  return {
    issuer: opts.issuer,
    authorization_endpoint: opts.authorizationEndpoint,
    token_endpoint: opts.tokenEndpoint,
    userinfo_endpoint: opts.userinfoEndpoint,
    jwks_uri: opts.jwksUri,
    end_session_endpoint: opts.endSessionEndpoint,
    response_types_supported: ["code", "id_token", "id_token token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: ["openid", "email", "profile"],
    claims_supported: ["sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name"],
  };
}

// ---------- Authorization codes (in-memory) ----------

export interface AuthorizationCodeRecord {
  code: string;
  clientId: string;
  redirectUri: string;
  userSub: string;
  scope: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  expiresAt: number; // ms
}

export interface AuthorizationCodeStore {
  put(rec: AuthorizationCodeRecord): void;
  consume(code: string): AuthorizationCodeRecord | null;
}

export function createInMemoryCodeStore(): AuthorizationCodeStore {
  const map = new Map<string, AuthorizationCodeRecord>();
  return {
    put: (rec) => {
      map.set(rec.code, rec);
    },
    consume: (code) => {
      const rec = map.get(code);
      if (!rec) return null;
      map.delete(code);
      if (rec.expiresAt < Date.now()) return null;
      return rec;
    },
  };
}

export function newAuthorizationCode(): string {
  return b64u(randomBytes(24));
}

export function validateAuthorizationCode(
  store: AuthorizationCodeStore,
  input: { code: string; clientId: string; redirectUri: string; codeVerifier?: string },
): AuthorizationCodeRecord {
  const rec = store.consume(input.code);
  if (!rec) throw new Error("Invalid or expired authorization code");
  if (rec.clientId !== input.clientId) throw new Error("client_id mismatch");
  if (rec.redirectUri !== input.redirectUri) throw new Error("redirect_uri mismatch");
  if (rec.codeChallenge) {
    if (!input.codeVerifier) throw new Error("code_verifier required");
    if (!pkceVerify(input.codeVerifier, rec.codeChallenge, rec.codeChallengeMethod ?? "S256")) {
      throw new Error("PKCE verification failed");
    }
  }
  return rec;
}

// ---------- PKCE (RFC 7636) ----------

export function pkceVerify(codeVerifier: string, codeChallenge: string, method: "S256" | "plain"): boolean {
  if (method === "plain") return codeVerifier === codeChallenge;
  const expected = b64u(createHash("sha256").update(codeVerifier).digest());
  return expected === codeChallenge;
}

// Re-export helpers for tests / SP-side use.
export const _internal = { b64u, b64uDecode };
