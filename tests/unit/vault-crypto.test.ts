import { describe, it, expect, beforeAll } from "vitest";

describe("vault crypto", () => {
  beforeAll(() => {
    process.env.VAULT_ENCRYPTION_KEY = "test-key-for-vitest-not-for-production";
  });

  it("round-trips a secret", async () => {
    const { encryptSecret, decryptSecret } = await import("@/modules/vault/crypto");
    const enc = encryptSecret("hunter2!");
    expect(enc.cipher).toBeTypeOf("string");
    expect(enc.iv).toBeTypeOf("string");
    expect(enc.tag).toBeTypeOf("string");
    expect(decryptSecret(enc)).toBe("hunter2!");
  });

  it("produces unique IVs across calls", async () => {
    const { encryptSecret } = await import("@/modules/vault/crypto");
    const ivs = new Set<string>();
    for (let i = 0; i < 25; i++) {
      ivs.add(encryptSecret("same-text").iv);
    }
    expect(ivs.size).toBe(25);
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/modules/vault/crypto");
    const enc = encryptSecret("payload");
    const flipped = Buffer.from(enc.cipher, "base64");
    flipped[0] ^= 0xff;
    expect(() => decryptSecret({ ...enc, cipher: flipped.toString("base64") })).toThrow();
  });

  it("rejects tampered auth tag", async () => {
    const { encryptSecret, decryptSecret } = await import("@/modules/vault/crypto");
    const enc = encryptSecret("payload");
    const tag = Buffer.from(enc.tag, "base64");
    tag[0] ^= 0xff;
    expect(() => decryptSecret({ ...enc, tag: tag.toString("base64") })).toThrow();
  });

  it("masks secrets to bullets", async () => {
    const { maskSecret } = await import("@/modules/vault/crypto");
    expect(maskSecret("")).toBe("");
    expect(maskSecret("ab")).toBe("••");
    expect(maskSecret("abcdefghij").length).toBeGreaterThan(0);
  });
});
