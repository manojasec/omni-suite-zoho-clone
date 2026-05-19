import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  buildAuthorizeUrl,
  buildTokenRequestBody,
  generatePkce,
  parseCallback,
  signState,
  verifyState,
  type OAuthProvider,
} from "@/modules/social/oauth";

const provider: OAuthProvider = {
  id: "TWITTER",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  clientId: "demo-client",
  scopes: ["tweet.read", "tweet.write", "users.read"],
};

describe("social oauth — PKCE", () => {
  it("generates a 43+ char URL-safe verifier and matching SHA-256 S256 challenge", () => {
    const p = generatePkce();
    expect(p.method).toBe("S256");
    expect(p.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(p.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
    const expected = createHash("sha256")
      .update(p.codeVerifier)
      .digest("base64")
      .replace(/=+$/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(p.codeChallenge).toBe(expected);
  });
});

describe("social oauth — authorize URL", () => {
  it("builds a fully-formed URL with required params", () => {
    const pkce = generatePkce();
    const url = buildAuthorizeUrl({
      provider,
      redirectUri: "https://app.example.com/cb",
      state: "xyz",
      pkce,
      extra: { prompt: "consent" },
    });
    const u = new URL(url);
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("demo-client");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example.com/cb");
    expect(u.searchParams.get("scope")).toBe("tweet.read tweet.write users.read");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toBe(pkce.codeChallenge);
    expect(u.searchParams.get("state")).toBe("xyz");
    expect(u.searchParams.get("prompt")).toBe("consent");
  });
});

describe("social oauth — state token", () => {
  it("roundtrips and rejects tampering", () => {
    const tok = signState("ws1", "u1", "nonce-abc", "secret-1");
    expect(verifyState(tok, "secret-1")).toEqual({
      workspaceId: "ws1",
      userId: "u1",
      nonce: "nonce-abc",
    });
    expect(verifyState(tok, "wrong-secret")).toBeNull();
    expect(verifyState(tok.replace(/[a-z]/, "X"), "secret-1")).toBeNull();
    expect(verifyState("garbage", "secret-1")).toBeNull();
  });
});

describe("social oauth — callback + token body", () => {
  it("parseCallback returns ok on code+state", () => {
    const r = parseCallback(new URLSearchParams({ code: "c", state: "s" }));
    expect(r).toEqual({ ok: true, code: "c", state: "s" });
  });
  it("parseCallback surfaces error param", () => {
    const r = parseCallback({ error: "access_denied", error_description: "User said no" });
    expect(r).toEqual({ ok: false, error: "access_denied", description: "User said no" });
  });
  it("parseCallback fails on missing code", () => {
    expect(parseCallback({ state: "s" }).ok).toBe(false);
  });

  it("buildTokenRequestBody includes grant_type + code_verifier", () => {
    const body = buildTokenRequestBody({
      provider,
      code: "abc",
      redirectUri: "https://app.example.com/cb",
      codeVerifier: "verifier-1",
      clientSecret: "shh",
    });
    const u = new URLSearchParams(body);
    expect(u.get("grant_type")).toBe("authorization_code");
    expect(u.get("code")).toBe("abc");
    expect(u.get("code_verifier")).toBe("verifier-1");
    expect(u.get("client_id")).toBe("demo-client");
    expect(u.get("client_secret")).toBe("shh");
  });
});
