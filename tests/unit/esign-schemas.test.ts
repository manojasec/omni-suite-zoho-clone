import { describe, expect, it } from "vitest";
import {
  envelopeSchema,
  signSubmitSchema,
  declineSchema,
} from "@/modules/esign/schemas";
import { generateAccessToken } from "@/modules/esign/token";

describe("esign/schemas", () => {
  describe("envelopeSchema", () => {
    const base = {
      title: "MSA",
      documentUrl: "https://example.com/doc.pdf",
      signers: [{ name: "Alice", email: "alice@example.com" }],
    };
    it("accepts a minimal valid envelope", () => {
      expect(envelopeSchema.safeParse(base).success).toBe(true);
    });
    it("requires title", () => {
      expect(envelopeSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    });
    it("requires a valid document URL", () => {
      expect(envelopeSchema.safeParse({ ...base, documentUrl: "not-a-url" }).success).toBe(false);
    });
    it("requires at least one signer", () => {
      expect(envelopeSchema.safeParse({ ...base, signers: [] }).success).toBe(false);
    });
    it("rejects invalid signer email", () => {
      const r = envelopeSchema.safeParse({
        ...base,
        signers: [{ name: "X", email: "not-email" }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe("signSubmitSchema", () => {
    it("requires agreement checkbox", () => {
      const r = signSubmitSchema.safeParse({ signatureName: "Alice", agree: false });
      expect(r.success).toBe(false);
    });
    it("accepts agreement via 'on' string", () => {
      const r = signSubmitSchema.safeParse({ signatureName: "Alice", agree: "on" });
      expect(r.success).toBe(true);
    });
    it("requires name with min 2 chars", () => {
      expect(signSubmitSchema.safeParse({ signatureName: "A", agree: true }).success).toBe(false);
    });
  });

  describe("declineSchema", () => {
    it("requires non-empty reason", () => {
      expect(declineSchema.safeParse({ reason: "" }).success).toBe(false);
    });
    it("accepts a valid reason", () => {
      expect(declineSchema.safeParse({ reason: "Not relevant" }).success).toBe(true);
    });
  });
});

describe("esign/token", () => {
  it("generates URL-safe tokens", () => {
    const t = generateAccessToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThan(20);
  });
  it("generates unique tokens", () => {
    const a = generateAccessToken();
    const b = generateAccessToken();
    expect(a).not.toBe(b);
  });
});
