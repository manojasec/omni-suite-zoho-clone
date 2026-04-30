import { describe, expect, it } from "vitest";
import {
  applyTax,
  formatRate,
  splitInclusive,
  taxRateSchema,
} from "@/modules/tax-rates/schemas";

describe("tax-rates/schemas", () => {
  it("formats rate with two decimals and percent suffix", () => {
    expect(formatRate(7.5)).toBe("7.50%");
    expect(formatRate(0)).toBe("0.00%");
  });

  it("applies exclusive tax: 10% on 100 = 10", () => {
    expect(applyTax({ amount: 100, rate: 10, inclusive: false })).toBe(10);
  });

  it("applies inclusive tax: 10% on 110 = 10", () => {
    expect(applyTax({ amount: 110, rate: 10, inclusive: true })).toBe(10);
  });

  it("rounds tax to 2 decimal places", () => {
    expect(applyTax({ amount: 33.33, rate: 7.5, inclusive: false })).toBe(2.5);
  });

  it("returns 0 when rate or amount is 0", () => {
    expect(applyTax({ amount: 0, rate: 10, inclusive: false })).toBe(0);
    expect(applyTax({ amount: 100, rate: 0, inclusive: false })).toBe(0);
  });

  it("splitInclusive returns matching net + tax that sum back", () => {
    const r = splitInclusive(110, 10);
    expect(r).toEqual({ net: 100, tax: 10 });
    expect(r.net + r.tax).toBe(110);
  });

  it("validates a minimum tax rate payload", () => {
    const r = taxRateSchema.safeParse({
      name: "GST",
      rate: 18,
      region: "",
      isInclusive: false,
      isDefault: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative rates", () => {
    const r = taxRateSchema.safeParse({ name: "X", rate: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects rates above 100", () => {
    const r = taxRateSchema.safeParse({ name: "X", rate: 150 });
    expect(r.success).toBe(false);
  });

  it("rejects empty name", () => {
    const r = taxRateSchema.safeParse({ name: "", rate: 5 });
    expect(r.success).toBe(false);
  });

  it("rejects names over 120 chars", () => {
    const r = taxRateSchema.safeParse({
      name: "a".repeat(121),
      rate: 5,
    });
    expect(r.success).toBe(false);
  });

  it("coerces string rate input", () => {
    const r = taxRateSchema.safeParse({ name: "VAT", rate: "20" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rate).toBe(20);
  });
});
