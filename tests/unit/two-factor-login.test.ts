import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  signTwoFactorToken,
  verifyTwoFactorToken,
} from "@/lib/two-factor-cookie";
import { userHasActiveTwoFactor } from "@/lib/two-factor-cookie";

const ORIGINAL_SECRET = process.env.NEXTAUTH_SECRET;

describe("two-factor-cookie", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-2fa-cookie-1234567890";
  });
  afterEach(() => {
    process.env.NEXTAUTH_SECRET = ORIGINAL_SECRET;
  });

  it("signed tokens round-trip", () => {
    const token = signTwoFactorToken({ userId: "user_123" });
    const verified = verifyTwoFactorToken(token);
    expect(verified).toEqual({ userId: "user_123" });
  });

  it("rejects tampered payload", () => {
    const token = signTwoFactorToken({ userId: "user_123" });
    const [body, sig] = token.split(".");
    const tamperedBody = body.slice(0, -1) + (body.slice(-1) === "A" ? "B" : "A");
    expect(verifyTwoFactorToken(`${tamperedBody}.${sig}`)).toBeNull();
  });

  it("rejects tampered signature", () => {
    const token = signTwoFactorToken({ userId: "user_123" });
    const [body, sig] = token.split(".");
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === "0" ? "1" : "0");
    expect(verifyTwoFactorToken(`${body}.${tamperedSig}`)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = signTwoFactorToken({ userId: "user_123", ttlSeconds: -1 });
    expect(verifyTwoFactorToken(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyTwoFactorToken("")).toBeNull();
    expect(verifyTwoFactorToken("abc")).toBeNull();
    expect(verifyTwoFactorToken("a.b.c")).toBeNull();
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signTwoFactorToken({ userId: "user_123" });
    process.env.NEXTAUTH_SECRET = "a-different-secret-value-aaaaaa";
    expect(verifyTwoFactorToken(token)).toBeNull();
  });
});

describe("userHasActiveTwoFactor", () => {
  it("returns false for null/undefined/empty", () => {
    expect(userHasActiveTwoFactor(null)).toBe(false);
    expect(userHasActiveTwoFactor("")).toBe(false);
  });

  it("returns false for a pending enrolment", () => {
    expect(userHasActiveTwoFactor("PENDING:JBSWY3DPEHPK3PXP")).toBe(false);
  });

  it("returns true for a confirmed secret", () => {
    expect(userHasActiveTwoFactor("JBSWY3DPEHPK3PXP")).toBe(true);
  });
});
