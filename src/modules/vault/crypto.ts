import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (!raw) {
    // Dev fallback derived from AUTH_SECRET; production MUST set VAULT_ENCRYPTION_KEY.
    const seed = process.env.AUTH_SECRET ?? "omnisuite-dev-vault-key";
    return createHash("sha256").update(seed).digest();
  }
  // Accept base64 or utf8 strings; always derive 32 bytes via SHA-256 for predictability.
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): { cipher: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipherer = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipherer.update(plaintext, "utf8"), cipherer.final()]);
  const tag = cipherer.getAuthTag();
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(parts: { cipher: string; iv: string; tag: string }): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(parts.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parts.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(parts.cipher, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function maskSecret(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 4) return "•".repeat(plain.length);
  return "•".repeat(Math.min(plain.length, 12));
}
