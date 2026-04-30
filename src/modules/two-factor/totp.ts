import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Minimal RFC 6238 TOTP implementation backed by the Node crypto module.
 * Uses a 30-second step and SHA-1, the defaults expected by Google Authenticator
 * and most TOTP apps.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;

/** Base32 (RFC 4648) helpers — small, stdlib-free. */
const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i += 1) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPH[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(s: string): Buffer {
  const cleaned = s.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = ALPH.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildTotpUri(input: {
  account: string;
  issuer: string;
  secret: string;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit counter big-endian, JS-safe up to 2^53.
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpCode(
  secret: string,
  atSeconds = Math.floor(Date.now() / 1000),
): string {
  const counter = Math.floor(atSeconds / STEP_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/** Verify a code against the current ±1 step window. */
export function verifyTotpCode(
  secret: string,
  code: string,
  atSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(atSeconds / STEP_SECONDS);
  const decoded = base32Decode(secret);
  for (let drift = -1; drift <= 1; drift += 1) {
    const expected = hotp(decoded, counter + drift);
    if (
      expected.length === code.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(code))
    ) {
      return true;
    }
  }
  return false;
}

const RECOVERY_LEN = 10;

/** Generate `count` user-friendly recovery codes (10 chars, base32). */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(base32Encode(randomBytes(8)).slice(0, RECOVERY_LEN));
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function verifyRecoveryCode(code: string, hash: string): boolean {
  const a = Buffer.from(hashRecoveryCode(code));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
