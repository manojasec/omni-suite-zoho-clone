import { describe, expect, it } from "vitest";
import {
  expenseCategorySchema,
  expenseSchema,
} from "@/modules/expenses/schemas";

describe("expenses/schemas", () => {
  describe("expenseCategorySchema", () => {
    it("requires a name", () => {
      const r = expenseCategorySchema.safeParse({ name: "" });
      expect(r.success).toBe(false);
    });

    it("accepts a minimal valid input", () => {
      const r = expenseCategorySchema.safeParse({ name: "Travel" });
      expect(r.success).toBe(true);
    });

    it("trims and accepts an optional code", () => {
      const r = expenseCategorySchema.safeParse({ name: "Travel", code: "  TRV  " });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.code).toBe("TRV");
    });
  });

  describe("expenseSchema", () => {
    const base = {
      expenseDate: "2026-01-15",
      merchant: "Delta",
      amount: "125.50",
    };

    it("rejects missing merchant", () => {
      const r = expenseSchema.safeParse({ ...base, merchant: "" });
      expect(r.success).toBe(false);
    });

    it("rejects amount of zero or negative", () => {
      const r = expenseSchema.safeParse({ ...base, amount: "0" });
      expect(r.success).toBe(false);
      const n = expenseSchema.safeParse({ ...base, amount: "-5" });
      expect(n.success).toBe(false);
    });

    it("coerces strings to numbers and provides defaults", () => {
      const r = expenseSchema.safeParse(base);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.amount).toBe(125.5);
        expect(r.data.taxAmount).toBe(0);
        expect(r.data.currency).toBe("USD");
        expect(r.data.reimbursable).toBe(true);
      }
    });

    it("validates receipt URL format", () => {
      const ok = expenseSchema.safeParse({ ...base, receiptUrl: "https://example.com/r.pdf" });
      expect(ok.success).toBe(true);
      const bad = expenseSchema.safeParse({ ...base, receiptUrl: "not-a-url" });
      expect(bad.success).toBe(false);
    });

    it("allows empty receipt URL", () => {
      const r = expenseSchema.safeParse({ ...base, receiptUrl: "" });
      expect(r.success).toBe(true);
    });

    it("requires currency to be exactly 3 characters", () => {
      const r = expenseSchema.safeParse({ ...base, currency: "US" });
      expect(r.success).toBe(false);
    });
  });
});
