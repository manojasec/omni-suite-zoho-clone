import { describe, it, expect } from "vitest";
import { computeTotals, lineAmount } from "@/modules/billing/totals";

describe("computeTotals", () => {
  it("sums multiple line items with mixed taxes", () => {
    const t = computeTotals([
      { description: "A", qty: "2", unitPrice: "100", taxPercent: "10" },
      { description: "B", qty: "1", unitPrice: "50", taxPercent: "0" },
    ]);
    expect(t.subtotal).toBe("250.00");
    expect(t.tax).toBe("20.00");
    expect(t.total).toBe("270.00");
  });

  it("returns zeros for an empty cart", () => {
    expect(computeTotals([])).toEqual({ subtotal: "0.00", tax: "0.00", total: "0.00" });
  });

  it("rounds to 2 decimals", () => {
    const t = computeTotals([
      { description: "X", qty: "3", unitPrice: "9.99", taxPercent: "8.25" },
    ]);
    // subtotal = 29.97; tax = 2.4725...; total = 32.44...
    expect(t.subtotal).toBe("29.97");
    expect(t.tax).toBe("2.47");
    expect(t.total).toBe("32.44");
  });
});

describe("lineAmount", () => {
  it("returns line total including tax", () => {
    expect(lineAmount({ description: "x", qty: "2", unitPrice: "100", taxPercent: "10" })).toBe("220.00");
  });
});
