import { createHmac, timingSafeEqual } from "crypto";

/**
 * Tiny HMAC-signed payload helper used for the pre-2FA login challenge cookie
 * (and the matching `signIn("two-factor")` proof). We deliberately avoid
 * pulling in JWT for this — the payload only needs to bind a userId to a
 * short expiry and be tamper-proof against the application's NEXTAUTH_SECRET.
 *
 * Format: base64url(JSON({u,exp})).hex(hmacSha256)
 */

const PURPOSE = "2fa-login";

const PENDING_PREFIX = "PENDING:";

export function userHasActiveTwoFactor(secret: string | null | undefined): boolean {
  return !!secret && !secret.startsWith(PENDING_PREFIX);
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not configured");
  return s;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return createHmac("sha256", `${secret()}:${PURPOSE}`)
    .update(payload)
    .digest("hex");
}

export function signTwoFactorToken(input: {
  userId: string;
  ttlSeconds?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 600);
  const body = b64url(JSON.stringify({ u: input.userId, exp }));
  return `${body}.${sign(body)}`;
}

export function verifyTwoFactorToken(
  token: string,
): { userId: string } | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: { u?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.u !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

  return { userId: parsed.u };
}
