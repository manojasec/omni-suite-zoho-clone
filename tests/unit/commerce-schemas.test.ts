import { describe, expect, it } from "vitest";
import {
  STORE_ORDER_TRANSITIONS,
  addOrderItemSchema,
  aggregateOrderTotals,
  canTransitionOrder,
  computeLineTotals,
  createOrderSchema,
  formatMoney,
  slugify,
  storeCustomerSchema,
  storefrontSchema,
  updateOrderItemSchema,
} from "@/modules/commerce/schemas";

class FakeDecimal {
  constructor(private readonly n: number) {}
  toNumber(): number {
    return this.n;
  }
}

describe("storefrontSchema", () => {
  it("accepts a clean storefront and uppercases currency", () => {
    const out = storefrontSchema.parse({
      slug: "MyStore",
      name: "My Store",
      currency: "usd",
    });
    expect(out.slug).toBe("mystore");
    expect(out.currency).toBe("USD");
    expect(out.status).toBe("DRAFT");
  });

  it("treats empty supportEmail and headline as undefined", () => {
    const out = storefrontSchema.parse({
      slug: "shop",
      name: "Shop",
      headline: "",
      supportEmail: "",
    });
    expect(out.headline).toBeUndefined();
    expect(out.supportEmail).toBeUndefined();
  });

  it("rejects bad slugs", () => {
    expect(() =>
      storefrontSchema.parse({ slug: "-bad", name: "X" }),
    ).toThrow();
    expect(() =>
      storefrontSchema.parse({ slug: "with space", name: "X" }),
    ).toThrow();
    expect(() =>
      storefrontSchema.parse({ slug: "a", name: "X" }),
    ).toThrow();
  });
});

describe("storeCustomerSchema", () => {
  it("lowercases email and trims fields", () => {
    const out = storeCustomerSchema.parse({
      email: "  Buyer@Example.COM ",
      name: "  Buyer  ",
    });
    expect(out.email).toBe("buyer@example.com");
    expect(out.name).toBe("Buyer");
  });

  it("converts empty optional strings to undefined", () => {
    const out = storeCustomerSchema.parse({
      email: "x@y.com",
      name: "X",
      phone: "",
      shippingAddress: "",
      notes: "",
    });
    expect(out.phone).toBeUndefined();
    expect(out.shippingAddress).toBeUndefined();
    expect(out.notes).toBeUndefined();
  });
});

describe("createOrderSchema / item schemas", () => {
  it("defaults currency to USD when missing", () => {
    const out = createOrderSchema.parse({ customerId: "c1" });
    expect(out.currency).toBe("USD");
  });

  it("coerces quantity strings on add", () => {
    const out = addOrderItemSchema.parse({ productId: "p", quantity: "3" });
    expect(out.quantity).toBe(3);
  });

  it("rejects quantity below 1 or above 10000", () => {
    expect(() =>
      addOrderItemSchema.parse({ productId: "p", quantity: 0 }),
    ).toThrow();
    expect(() =>
      addOrderItemSchema.parse({ productId: "p", quantity: 10001 }),
    ).toThrow();
  });

  it("update schema also coerces and clamps", () => {
    expect(updateOrderItemSchema.parse({ quantity: "5" }).quantity).toBe(5);
    expect(() => updateOrderItemSchema.parse({ quantity: 0 })).toThrow();
  });
});

describe("computeLineTotals", () => {
  it("computes from plain numbers with tax", () => {
    expect(
      computeLineTotals({ unitPrice: 10, taxPercent: 10, quantity: 2 }),
    ).toEqual({ lineSubtotal: 20, lineTax: 2, lineTotal: 22 });
  });

  it("supports Prisma-Decimal-like values via toNumber()", () => {
    expect(
      computeLineTotals({
        unitPrice: new FakeDecimal(12.5),
        taxPercent: new FakeDecimal(8),
        quantity: 4,
      }),
    ).toEqual({ lineSubtotal: 50, lineTax: 4, lineTotal: 54 });
  });

  it("returns zeros for negative price", () => {
    expect(
      computeLineTotals({ unitPrice: -1, taxPercent: 10, quantity: 2 }),
    ).toEqual({ lineSubtotal: 0, lineTax: 0, lineTotal: 0 });
  });

  it("returns zeros for non-positive quantity", () => {
    expect(
      computeLineTotals({ unitPrice: 5, taxPercent: 0, quantity: 0 }),
    ).toEqual({ lineSubtotal: 0, lineTax: 0, lineTotal: 0 });
  });

  it("handles 0% tax", () => {
    expect(
      computeLineTotals({ unitPrice: 9.99, taxPercent: 0, quantity: 3 }),
    ).toEqual({ lineSubtotal: 29.97, lineTax: 0, lineTotal: 29.97 });
  });

  it("returns zeros for non-finite quantity", () => {
    expect(
      computeLineTotals({
        unitPrice: 10,
        taxPercent: 5,
        quantity: Number.NaN,
      }),
    ).toEqual({ lineSubtotal: 0, lineTax: 0, lineTotal: 0 });
  });
});

describe("aggregateOrderTotals", () => {
  it("sums subtotal, tax, total, and item count", () => {
    const out = aggregateOrderTotals([
      { lineSubtotal: 20, lineTax: 2, lineTotal: 22, quantity: 2 },
      {
        lineSubtotal: new FakeDecimal(50),
        lineTax: new FakeDecimal(4),
        lineTotal: new FakeDecimal(54),
        quantity: 4,
      },
    ]);
    expect(out).toEqual({
      subtotal: 70,
      tax: 6,
      total: 76,
      itemCount: 6,
    });
  });

  it("returns zeros for empty list", () => {
    expect(aggregateOrderTotals([])).toEqual({
      subtotal: 0,
      tax: 0,
      total: 0,
      itemCount: 0,
    });
  });

  it("ignores non-finite quantities for itemCount", () => {
    const out = aggregateOrderTotals([
      {
        lineSubtotal: 10,
        lineTax: 0,
        lineTotal: 10,
        quantity: Number.NaN,
      },
    ]);
    expect(out.itemCount).toBe(0);
  });
});

describe("canTransitionOrder", () => {
  it("allows PENDING → PAID and PENDING → CANCELED", () => {
    expect(canTransitionOrder("PENDING", "PAID")).toBe(true);
    expect(canTransitionOrder("PENDING", "CANCELED")).toBe(true);
  });

  it("allows PAID → FULFILLED and PAID → REFUNDED", () => {
    expect(canTransitionOrder("PAID", "FULFILLED")).toBe(true);
    expect(canTransitionOrder("PAID", "REFUNDED")).toBe(true);
  });

  it("allows FULFILLED → REFUNDED only", () => {
    expect(canTransitionOrder("FULFILLED", "REFUNDED")).toBe(true);
    expect(canTransitionOrder("FULFILLED", "PAID")).toBe(false);
  });

  it("treats CANCELED and REFUNDED as terminal", () => {
    expect(STORE_ORDER_TRANSITIONS.CANCELED).toEqual([]);
    expect(STORE_ORDER_TRANSITIONS.REFUNDED).toEqual([]);
    expect(canTransitionOrder("CANCELED", "PAID")).toBe(false);
    expect(canTransitionOrder("REFUNDED", "PAID")).toBe(false);
  });

  it("forbids backward transitions", () => {
    expect(canTransitionOrder("PAID", "PENDING")).toBe(false);
    expect(canTransitionOrder("FULFILLED", "PAID")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("groups thousands and pads to 2dp", () => {
    expect(formatMoney(1234567.5, "USD")).toBe("USD 1,234,567.50");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0, "EUR")).toBe("EUR 0.00");
  });

  it("falls back to zero for non-finite amounts", () => {
    expect(formatMoney(Number.NaN, "USD")).toBe("USD 0.00");
    expect(formatMoney(Number.POSITIVE_INFINITY, "USD")).toBe("USD 0.00");
  });
});

describe("slugify", () => {
  it("replaces special chars with hyphens", () => {
    expect(slugify("My Awesome Store!")).toBe("my-awesome-store");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("caps length at 60 characters", () => {
    expect(slugify("a".repeat(120)).length).toBeLessThanOrEqual(60);
  });
});
