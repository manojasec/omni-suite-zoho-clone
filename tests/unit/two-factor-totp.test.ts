import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  buildTotpUri,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSecret,
  hashRecoveryCode,
  verifyRecoveryCode,
  verifyTotpCode,
} from "@/modules/two-factor/totp";

describe("two-factor/totp", () => {
  it("base32 encode and decode round-trip", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x12]);
    const encoded = base32Encode(buf);
    const decoded = base32Decode(encoded);
    expect(decoded.equals(buf)).toBe(true);
  });

  it("generates a base32 secret of expected length", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(32);
  });

  it("buildTotpUri produces an otpauth URI with the secret", () => {
    const uri = buildTotpUri({
      account: "user@example.com",
      issuer: "OmniSuite",
      secret: "ABCDEFGHIJKLMNOP",
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=ABCDEFGHIJKLMNOP");
    expect(uri).toContain("issuer=OmniSuite");
  });

  it("verifyTotpCode accepts the current code", () => {
    const secret = generateTotpSecret();
    const t = Math.floor(Date.now() / 1000);
    const code = generateTotpCode(secret, t);
    expect(verifyTotpCode(secret, code, t)).toBe(true);
  });

  it("verifyTotpCode accepts ±1 step drift", () => {
    const secret = generateTotpSecret();
    const t = 1_700_000_000;
    const codePrev = generateTotpCode(secret, t - 30);
    const codeNext = generateTotpCode(secret, t + 30);
    expect(verifyTotpCode(secret, codePrev, t)).toBe(true);
    expect(verifyTotpCode(secret, codeNext, t)).toBe(true);
  });

  it("verifyTotpCode rejects codes more than one step away", () => {
    const secret = generateTotpSecret();
    const t = 1_700_000_000;
    const stale = generateTotpCode(secret, t - 120);
    expect(verifyTotpCode(secret, stale, t)).toBe(false);
  });

  it("verifyTotpCode rejects malformed input", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "12345", Date.now() / 1000)).toBe(false);
    expect(verifyTotpCode(secret, "abcdef", Date.now() / 1000)).toBe(false);
  });

  it("generateRecoveryCodes returns the requested unique count", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-7]+$/);
      expect(c.length).toBe(10);
    }
  });

  it("recovery code hash verifies and is case-insensitive", () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code);
    expect(verifyRecoveryCode(code, hash)).toBe(true);
    expect(verifyRecoveryCode(code.toLowerCase(), hash)).toBe(true);
    expect(verifyRecoveryCode("NOTACODE12", hash)).toBe(false);
  });
});
