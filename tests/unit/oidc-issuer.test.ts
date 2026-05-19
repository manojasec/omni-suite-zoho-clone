import { describe, it, expect } from "vitest";
import {
  buildDiscoveryDoc,
  buildJwks,
  createInMemoryCodeStore,
  generateRsaKey,
  newAuthorizationCode,
  pkceVerify,
  rsaJwk,
  signIdToken,
  thumbprintKid,
  validateAuthorizationCode,
  verifyIdToken,
} from "@/modules/sso/oidc-issuer";

describe("oidc-issuer — keys + JWKS", () => {
  it("generates an RSA signing key with stable kid", () => {
    const key = generateRsaKey(2048);
    expect(key.alg).toBe("RS256");
    expect(key.kid).toBe(thumbprintKid(key.publicKeyPem));
    expect(key.publicKeyPem).toMatch(/PUBLIC KEY/);
  });

  it("rsaJwk exposes only public components", () => {
    const key = generateRsaKey(2048);
    const jwk = rsaJwk(key.publicKeyPem, key.kid);
    expect(jwk.kty).toBe("RSA");
    expect(jwk.alg).toBe("RS256");
    expect(jwk.use).toBe("sig");
    expect(jwk.n.length).toBeGreaterThan(0);
    expect(jwk.e.length).toBeGreaterThan(0);
    expect(Object.keys(jwk)).not.toContain("d");
  });

  it("buildJwks bundles multiple keys", () => {
    const a = generateRsaKey(2048);
    const b = generateRsaKey(2048);
    const set = buildJwks([a, b]);
    expect(set.keys).toHaveLength(2);
    expect(set.keys.map((k) => k.kid)).toEqual([a.kid, b.kid]);
  });
});

describe("oidc-issuer — JWT sign + verify", () => {
  const key = generateRsaKey(2048);
  const issuer = "https://idp.example.com";
  const now = new Date("2026-05-09T12:00:00Z");
  const baseClaims = {
    iss: issuer,
    sub: "user-123",
    aud: "client-abc",
    exp: Math.floor(now.getTime() / 1000) + 600,
    iat: Math.floor(now.getTime() / 1000),
    email: "alice@example.com",
    nonce: "n-1",
  };

  it("signs and verifies an ID token", () => {
    const jwt = signIdToken(baseClaims, key);
    const v = verifyIdToken(jwt, key.publicKeyPem, {
      issuer,
      audience: "client-abc",
      now,
      nonce: "n-1",
    });
    expect(v.sub).toBe("user-123");
    expect(v.email).toBe("alice@example.com");
  });

  it("rejects expired tokens", () => {
    const jwt = signIdToken({ ...baseClaims, exp: baseClaims.iat - 100 }, key);
    expect(() => verifyIdToken(jwt, key.publicKeyPem, { issuer, audience: "client-abc", now })).toThrow(/expired/);
  });

  it("rejects wrong audience", () => {
    const jwt = signIdToken(baseClaims, key);
    expect(() => verifyIdToken(jwt, key.publicKeyPem, { issuer, audience: "other", now })).toThrow(/aud/);
  });

  it("rejects nonce mismatch", () => {
    const jwt = signIdToken(baseClaims, key);
    expect(() =>
      verifyIdToken(jwt, key.publicKeyPem, { issuer, audience: "client-abc", now, nonce: "wrong" }),
    ).toThrow(/nonce/);
  });

  it("rejects tampered payload", () => {
    const jwt = signIdToken(baseClaims, key);
    const parts = jwt.split(".");
    // Flip a base64url char in the payload to tamper
    parts[1] = parts[1]!.replace(/[A-Za-z]/, (c) => (c === "A" ? "B" : "A"));
    const tampered = parts.join(".");
    expect(() => verifyIdToken(tampered, key.publicKeyPem, { issuer, audience: "client-abc", now })).toThrow();
  });
});

describe("oidc-issuer — discovery doc", () => {
  it("includes PKCE + RS256", () => {
    const doc = buildDiscoveryDoc({
      issuer: "https://idp.example.com",
      authorizationEndpoint: "https://idp.example.com/oauth/authorize",
      tokenEndpoint: "https://idp.example.com/oauth/token",
      jwksUri: "https://idp.example.com/.well-known/jwks.json",
    }) as Record<string, unknown>;
    expect(doc.issuer).toBe("https://idp.example.com");
    expect(doc.code_challenge_methods_supported).toContain("S256");
    expect(doc.id_token_signing_alg_values_supported).toContain("RS256");
  });
});

describe("oidc-issuer — authorization codes + PKCE", () => {
  it("PKCE S256 verifies a sha256-derived challenge", () => {
    // Known test vector from RFC 7636 Appendix B.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(pkceVerify(verifier, challenge, "S256")).toBe(true);
    expect(pkceVerify("wrong", challenge, "S256")).toBe(false);
  });

  it("PKCE plain compares verbatim", () => {
    expect(pkceVerify("abc", "abc", "plain")).toBe(true);
    expect(pkceVerify("abc", "abd", "plain")).toBe(false);
  });

  it("validates an authorization code with PKCE", () => {
    const store = createInMemoryCodeStore();
    const code = newAuthorizationCode();
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    store.put({
      code,
      clientId: "client-abc",
      redirectUri: "https://sp.example.com/cb",
      userSub: "user-1",
      scope: "openid email",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      expiresAt: Date.now() + 60_000,
    });
    const rec = validateAuthorizationCode(store, {
      code,
      clientId: "client-abc",
      redirectUri: "https://sp.example.com/cb",
      codeVerifier: verifier,
    });
    expect(rec.userSub).toBe("user-1");
  });

  it("authorization codes are single-use", () => {
    const store = createInMemoryCodeStore();
    const code = newAuthorizationCode();
    store.put({
      code,
      clientId: "c",
      redirectUri: "https://sp/cb",
      userSub: "u",
      scope: "openid",
      expiresAt: Date.now() + 60_000,
    });
    validateAuthorizationCode(store, { code, clientId: "c", redirectUri: "https://sp/cb" });
    expect(() =>
      validateAuthorizationCode(store, { code, clientId: "c", redirectUri: "https://sp/cb" }),
    ).toThrow(/Invalid or expired/);
  });

  it("rejects mismatched redirect_uri or client_id", () => {
    const store = createInMemoryCodeStore();
    const code = newAuthorizationCode();
    store.put({
      code,
      clientId: "c",
      redirectUri: "https://sp/cb",
      userSub: "u",
      scope: "openid",
      expiresAt: Date.now() + 60_000,
    });
    expect(() =>
      validateAuthorizationCode(store, { code, clientId: "wrong", redirectUri: "https://sp/cb" }),
    ).toThrow(/client_id/);
  });
});
