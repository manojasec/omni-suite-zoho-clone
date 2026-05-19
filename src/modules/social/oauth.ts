import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Social-platform OAuth helpers — pure builders.
 *
 * Each platform (Twitter/X, LinkedIn, Facebook, etc.) implements the OAuth 2.0
 * Authorization-Code flow with PKCE. This module provides the verifier
 * generator, the authorize URL builder, the callback validator, and the
 * token-request body builder. We deliberately do NOT perform the HTTP token
 * exchange here — that lives in the platform-specific adapter and is unit-
 * tested separately. Keeping these as pure string/Buffer helpers means the
 * whole flow is provider-agnostic and trivially testable.
 */

export type OAuthProvider =
  | { id: "TWITTER" | "LINKEDIN" | "FACEBOOK" | "INSTAGRAM" | "THREADS" | "MASTODON"; authorizeUrl: string; tokenUrl: string; clientId: string; scopes: string[] };

// ---------------- PKCE ----------------

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  method: "S256";
}

/** RFC 7636 §4.1 — 43..128 char URL-safe verifier. */
export function generatePkce(): PkcePair {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { codeVerifier: verifier, codeChallenge: challenge, method: "S256" };
}

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// ---------------- Authorize URL ----------------

export interface BuildAuthorizeUrlInput {
  provider: OAuthProvider;
  redirectUri: string;
  state: string;
  pkce: PkcePair;
  /** Optional extra params (e.g. `prompt=consent`). */
  extra?: Record<string, string>;
}

export function buildAuthorizeUrl(input: BuildAuthorizeUrlInput): string {
  const u = new URL(input.provider.authorizeUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", input.provider.clientId);
  u.searchParams.set("redirect_uri", input.redirectUri);
  u.searchParams.set("scope", input.provider.scopes.join(" "));
  u.searchParams.set("state", input.state);
  u.searchParams.set("code_challenge", input.pkce.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  for (const [k, v] of Object.entries(input.extra ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

// ---------------- State token ----------------

/**
 * A stateless `state` parameter binds the callback to the originator + nonce
 * without server-side storage. Format: `<workspaceId>.<userId>.<nonceB64>.<sigB64>`
 * where sig = HMAC-SHA256-truncated(workspaceId|userId|nonce, secret).
 */

export function signState(
  workspaceId: string,
  userId: string,
  nonce: string,
  secret: string,
): string {
  const payload = `${workspaceId}.${userId}.${nonce}`;
  const sig = createHash("sha256").update(payload + ":" + secret).digest();
  return `${payload}.${base64Url(sig).slice(0, 22)}`;
}

export function verifyState(
  token: string,
  secret: string,
): { workspaceId: string; userId: string; nonce: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [workspaceId, userId, nonce, providedSig] = parts;
  if (!workspaceId || !userId || !nonce || !providedSig) return null;
  const expected = createHash("sha256")
    .update(`${workspaceId}.${userId}.${nonce}:${secret}`)
    .digest();
  const expectedTrunc = Buffer.from(base64Url(expected).slice(0, 22));
  const provided = Buffer.from(providedSig);
  if (expectedTrunc.length !== provided.length) return null;
  if (!timingSafeEqual(expectedTrunc, provided)) return null;
  return { workspaceId, userId, nonce };
}

// ---------------- Callback ----------------

export type CallbackResult =
  | { ok: true; code: string; state: string }
  | { ok: false; error: string; description?: string };

export function parseCallback(rawQuery: URLSearchParams | Record<string, string>): CallbackResult {
  const get = (k: string): string | null =>
    rawQuery instanceof URLSearchParams ? rawQuery.get(k) : (rawQuery[k] ?? null);
  const error = get("error");
  if (error) return { ok: false, error, description: get("error_description") ?? undefined };
  const code = get("code");
  const state = get("state");
  if (!code || !state) return { ok: false, error: "missing_code_or_state" };
  return { ok: true, code, state };
}

// ---------------- Token request body ----------------

export function buildTokenRequestBody(input: {
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientSecret?: string;
}): string {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", input.code);
  body.set("redirect_uri", input.redirectUri);
  body.set("client_id", input.provider.clientId);
  body.set("code_verifier", input.codeVerifier);
  if (input.clientSecret) body.set("client_secret", input.clientSecret);
  return body.toString();
}
