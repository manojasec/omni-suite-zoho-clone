import { describe, expect, it } from "vitest";
import { customerSchema, productSchema, invoiceSchema, paymentSchema } from "@/modules/billing/schemas";
import { computeTotals, lineAmount } from "@/modules/billing/totals";

describe("billing/totals", () => {
  it("computes a simple subtotal+tax+total", () => {
    const t = computeTotals([
      { description: "A", qty: "2", unitPrice: "100.00", taxPercent: "10" },
      { description: "B", qty: "1", unitPrice: "50.00", taxPercent: "0" },
    ]);
    expect(t.subtotal).toBe("250.00");
    expect(t.tax).toBe("20.00");
    expect(t.total).toBe("270.00");
  });

  it("returns zeros for empty list", () => {
    const t = computeTotals([]);
    expect(t).toEqual({ subtotal: "0.00", tax: "0.00", total: "0.00" });
  });

  it("computes a single line amount including tax", () => {
    const a = lineAmount({ description: "x", qty: "3", unitPrice: "10", taxPercent: "20" });
    expect(a).toBe("36.00");
  });
});

describe("billing/schemas — customerSchema", () => {
  it("requires a name", () => {
    expect(customerSchema.safeParse({ name: "" }).success).toBe(false);
    expect(customerSchema.safeParse({ name: "Acme Inc" }).success).toBe(true);
  });
  it("normalises email and empty optional fields", () => {
    const r = customerSchema.parse({ name: "Acme", email: "  X@Y.COM ", taxId: "" });
    expect(r.email).toBe("x@y.com");
    expect(r.taxId).toBeNull();
  });
  it("rejects an invalid email", () => {
    expect(customerSchema.safeParse({ name: "X", email: "nope" }).success).toBe(false);
  });
});

describe("billing/schemas — productSchema", () => {
  it("rejects negative price", () => {
    expect(productSchema.safeParse({ name: "x", price: "-1" }).success).toBe(false);
  });
  it("rejects tax over 100", () => {
    expect(productSchema.safeParse({ name: "x", taxPercent: "150" }).success).toBe(false);
  });
  it("accepts zero price (free product)", () => {
    const r = productSchema.parse({ name: "Trial", price: "0", taxPercent: "0" });
    expect(r.price).toBe("0.00");
  });
});

describe("billing/schemas — invoiceSchema", () => {
  it("requires customer + ≥1 line item", () => {
    expect(invoiceSchema.safeParse({ customerId: "", lineItems: [] }).success).toBe(false);
    expect(
      invoiceSchema.safeParse({
        customerId: "c",
        lineItems: [],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        customerId: "c",
        lineItems: [{ description: "x", qty: "1", unitPrice: "10", taxPercent: "0" }],
      }).success,
    ).toBe(true);
  });
});

describe("billing/schemas — paymentSchema", () => {
  it("requires amount and method", () => {
    expect(paymentSchema.safeParse({ amount: "0", method: "cash" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: "10", method: "" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amount: "10", method: "cash" }).success).toBe(true);
  });
});
