import { describe, it, expect } from "vitest";
import {
  payRunSchema,
  payItemSchema,
  addEmployeeToPayRunSchema,
  summarizePaySlip,
  aggregateRunTotals,
  defaultItemsFromSalary,
  formatMoney,
  formatDate,
} from "@/modules/payroll/schemas";

describe("payroll schemas", () => {
  describe("payRunSchema", () => {
    it("accepts a valid run", () => {
      const r = payRunSchema.safeParse({
        label: "April 2026 run",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        payDate: "2026-04-30",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.currency).toBe("USD");
    });

    it("uppercases currency", () => {
      const r = payRunSchema.safeParse({
        label: "x",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        payDate: "2026-04-30",
        currency: "eur",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.currency).toBe("EUR");
    });

    it("rejects when periodEnd is before periodStart", () => {
      const r = payRunSchema.safeParse({
        label: "x",
        periodStart: "2026-04-30",
        periodEnd: "2026-04-01",
        payDate: "2026-04-30",
      });
      expect(r.success).toBe(false);
    });

    it("rejects when payDate is before periodStart", () => {
      const r = payRunSchema.safeParse({
        label: "x",
        periodStart: "2026-04-15",
        periodEnd: "2026-04-30",
        payDate: "2026-04-01",
      });
      expect(r.success).toBe(false);
    });

    it("rejects empty label", () => {
      const r = payRunSchema.safeParse({
        label: "",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        payDate: "2026-04-30",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("payItemSchema", () => {
    it("coerces amount strings", () => {
      const r = payItemSchema.safeParse({ kind: "EARNING", label: "Bonus", amount: "150" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.amount).toBe(150);
    });
    it("rejects negative amounts", () => {
      expect(
        payItemSchema.safeParse({ kind: "TAX", label: "Tax", amount: -1 }).success,
      ).toBe(false);
    });
    it("rejects unknown kind", () => {
      expect(
        payItemSchema.safeParse({ kind: "BOGUS", label: "x", amount: 1 }).success,
      ).toBe(false);
    });
  });

  describe("addEmployeeToPayRunSchema", () => {
    it("requires employeeId", () => {
      expect(
        addEmployeeToPayRunSchema.safeParse({ employeeId: "", baseSalary: 100 }).success,
      ).toBe(false);
    });
    it("coerces baseSalary string", () => {
      const r = addEmployeeToPayRunSchema.safeParse({ employeeId: "abc", baseSalary: "5000" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.baseSalary).toBe(5000);
    });
  });

  describe("summarizePaySlip", () => {
    it("computes gross/deductions/tax/net", () => {
      const t = summarizePaySlip([
        { kind: "EARNING", amount: 5000 },
        { kind: "EARNING", amount: 500 },
        { kind: "DEDUCTION", amount: 200 },
        { kind: "TAX", amount: 1000 },
      ]);
      expect(t.gross).toBe(5500);
      expect(t.deductions).toBe(200);
      expect(t.tax).toBe(1000);
      expect(t.net).toBe(4300);
    });

    it("clamps net to 0 when deductions exceed earnings", () => {
      const t = summarizePaySlip([
        { kind: "EARNING", amount: 100 },
        { kind: "DEDUCTION", amount: 500 },
      ]);
      expect(t.net).toBe(0);
    });

    it("ignores negative or non-finite amounts", () => {
      const t = summarizePaySlip([
        { kind: "EARNING", amount: 1000 },
        { kind: "EARNING", amount: -50 },
        { kind: "TAX", amount: Number.NaN },
      ]);
      expect(t.gross).toBe(1000);
      expect(t.tax).toBe(0);
      expect(t.net).toBe(1000);
    });

    it("returns zeros for empty list", () => {
      const t = summarizePaySlip([]);
      expect(t).toEqual({ earnings: 0, deductions: 0, tax: 0, gross: 0, net: 0 });
    });

    it("handles Decimal-like values via toNumber()", () => {
      const t = summarizePaySlip([
        { kind: "EARNING", amount: { toNumber: () => 1000 } },
        { kind: "TAX", amount: { toNumber: () => 200 } },
      ]);
      expect(t.gross).toBe(1000);
      expect(t.tax).toBe(200);
      expect(t.net).toBe(800);
    });
  });

  describe("aggregateRunTotals", () => {
    it("sums slip totals", () => {
      const t = aggregateRunTotals([
        { gross: 1000, deductions: 100, tax: 200, net: 700 },
        { gross: 2000, deductions: 50, tax: 400, net: 1550 },
      ]);
      expect(t).toEqual({
        totalGross: 3000,
        totalDeductions: 150,
        totalTax: 600,
        totalNet: 2250,
      });
    });

    it("returns zeros for empty list", () => {
      expect(aggregateRunTotals([])).toEqual({
        totalGross: 0,
        totalDeductions: 0,
        totalTax: 0,
        totalNet: 0,
      });
    });
  });

  describe("defaultItemsFromSalary", () => {
    it("creates earning + 20% tax", () => {
      const items = defaultItemsFromSalary(5000);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ kind: "EARNING", label: "Base salary", amount: 5000 });
      expect(items[1]).toEqual({ kind: "TAX", label: "Income tax (20%)", amount: 1000 });
    });

    it("returns empty for non-positive salary", () => {
      expect(defaultItemsFromSalary(0)).toEqual([]);
      expect(defaultItemsFromSalary(-100)).toEqual([]);
    });
  });

  describe("formatMoney", () => {
    it("groups thousands and formats two decimals", () => {
      expect(formatMoney(1234567.5, "USD")).toBe("USD 1,234,567.50");
    });
    it("handles zero", () => {
      expect(formatMoney(0, "EUR")).toBe("EUR 0.00");
    });
    it("treats non-finite as zero", () => {
      expect(formatMoney(Number.NaN, "USD")).toBe("USD 0.00");
    });
  });

  describe("formatDate", () => {
    it("formats Date as YYYY-MM-DD", () => {
      expect(formatDate(new Date("2026-04-30T00:00:00Z"))).toBe("2026-04-30");
    });
    it("returns empty for null/undefined", () => {
      expect(formatDate(null)).toBe("");
      expect(formatDate(undefined)).toBe("");
    });
    it("returns empty for invalid string", () => {
      expect(formatDate("not-a-date")).toBe("");
    });
  });
});
