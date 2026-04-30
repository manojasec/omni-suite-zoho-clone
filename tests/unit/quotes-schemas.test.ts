import { describe, expect, it } from "vitest";
import {
  QUOTE_STATUSES,
  canTransitionQuote,
  computeLineTotal,
  computeQuoteTotals,
  formatQuoteStatus,
  nextQuoteNumber,
  quoteHeaderSchema,
  quoteLineSchema,
  quoteStatusColor,
} from "@/modules/quotes/schemas";

describe("quotes/schemas", () => {
  it("exposes the six quote statuses", () => {
    expect(QUOTE_STATUSES).toEqual([
      "DRAFT",
      "SENT",
      "ACCEPTED",
      "REJECTED",
      "EXPIRED",
      "CONVERTED",
    ]);
  });

  it("formats statuses to title case labels", () => {
    expect(formatQuoteStatus("DRAFT")).toBe("Draft");
    expect(formatQuoteStatus("SENT")).toBe("Sent");
    expect(formatQuoteStatus("CONVERTED")).toBe("Converted");
  });

  it("returns a distinct color class per status", () => {
    const colors = QUOTE_STATUSES.map((s) => quoteStatusColor(s));
    expect(new Set(colors).size).toBe(QUOTE_STATUSES.length);
  });

  it("computes a single line total with tax", () => {
    expect(computeLineTotal({ qty: 2, unitPrice: 50, taxPercent: 10 })).toEqual({
      amount: 100,
      taxAmount: 10,
    });
  });

  it("rounds line totals to two decimals", () => {
    const { amount, taxAmount } = computeLineTotal({
      qty: 3,
      unitPrice: 9.999,
      taxPercent: 7.25,
    });
    // 3 * 9.999 = 29.997 → 30.00; tax 30 * 0.0725 ≈ 2.17 (binary float rounding)
    expect(amount).toBe(30);
    expect(taxAmount).toBeGreaterThanOrEqual(2.17);
    expect(taxAmount).toBeLessThanOrEqual(2.18);
  });

  it("returns zero totals for an empty quote", () => {
    expect(computeQuoteTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });

  it("sums multi-line subtotals, tax and total", () => {
    const totals = computeQuoteTotals([
      { qty: 2, unitPrice: 50, taxPercent: 10 }, // 100 + 10
      { qty: 1, unitPrice: 200, taxPercent: 0 }, // 200 + 0
      { qty: 4, unitPrice: 25, taxPercent: 5 }, // 100 + 5
    ]);
    expect(totals.subtotal).toBe(400);
    expect(totals.tax).toBe(15);
    expect(totals.total).toBe(415);
  });

  it("rejects negative qty and unitPrice in line schema", () => {
    expect(quoteLineSchema.safeParse({
      description: "x",
      qty: -1,
      unitPrice: 10,
      taxPercent: 0,
    }).success).toBe(false);
    expect(quoteLineSchema.safeParse({
      description: "x",
      qty: 1,
      unitPrice: -5,
      taxPercent: 0,
    }).success).toBe(false);
  });

  it("requires a non-empty line description", () => {
    expect(
      quoteLineSchema.safeParse({
        description: "   ",
        qty: 1,
        unitPrice: 1,
        taxPercent: 0,
      }).success,
    ).toBe(false);
  });

  it("caps tax percent at 100", () => {
    expect(
      quoteLineSchema.safeParse({
        description: "x",
        qty: 1,
        unitPrice: 1,
        taxPercent: 200,
      }).success,
    ).toBe(false);
  });

  it("requires a customerId on the header", () => {
    expect(quoteHeaderSchema.safeParse({ customerId: "" }).success).toBe(false);
    const ok = quoteHeaderSchema.safeParse({ customerId: "cust_1" });
    expect(ok.success).toBe(true);
  });

  it("normalises empty expiresAt to undefined", () => {
    const parsed = quoteHeaderSchema.parse({ customerId: "c1", expiresAt: "" });
    expect(parsed.expiresAt).toBeUndefined();
  });

  it("allows DRAFT → SENT and SENT → ACCEPTED but blocks reverse", () => {
    expect(canTransitionQuote("DRAFT", "SENT")).toBe(true);
    expect(canTransitionQuote("SENT", "ACCEPTED")).toBe(true);
    expect(canTransitionQuote("ACCEPTED", "DRAFT")).toBe(false);
    expect(canTransitionQuote("CONVERTED", "DRAFT")).toBe(false);
  });

  it("only allows CONVERTED transition from ACCEPTED", () => {
    expect(canTransitionQuote("ACCEPTED", "CONVERTED")).toBe(true);
    expect(canTransitionQuote("DRAFT", "CONVERTED")).toBe(false);
    expect(canTransitionQuote("SENT", "CONVERTED")).toBe(false);
  });

  it("generates a sequential quote number from existing values", () => {
    expect(nextQuoteNumber([])).toBe("Q-0001");
    expect(nextQuoteNumber(["Q-0001", "Q-0002"])).toBe("Q-0003");
    expect(nextQuoteNumber(["Q-0007", "Q-0003", "ignored"])).toBe("Q-0008");
  });
});
