import { describe, expect, it } from "vitest";
import {
  addInterval,
  computeInitialPeriod,
  formatInvoiceNumber,
  isLiveSubscriptionStatus,
  isValidSubscriptionTransition,
  mrrFor,
  subscriptionPlanSchema,
  subscriptionSchema,
  subscriptionUpdateSchema,
} from "@/modules/subscriptions/schemas";

describe("subscriptionPlanSchema", () => {
  const base = { name: "Pro", code: "pro_monthly", amount: "29.99", currency: "USD", interval: "MONTH", intervalCount: "1", trialDays: "14" };
  it("accepts a valid plan", () => {
    const r = subscriptionPlanSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("pro_monthly");
  });
  it("lowercases code", () => {
    const r = subscriptionPlanSchema.safeParse({ ...base, code: "PRO_Monthly" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("pro_monthly");
  });
  it("rejects invalid code chars", () => {
    expect(subscriptionPlanSchema.safeParse({ ...base, code: "pro monthly" }).success).toBe(false);
  });
  it("rejects negative amount", () => {
    expect(subscriptionPlanSchema.safeParse({ ...base, amount: "-1" }).success).toBe(false);
  });
  it("rejects bad currency", () => {
    expect(subscriptionPlanSchema.safeParse({ ...base, currency: "us" }).success).toBe(false);
  });
  it("rejects intervalCount > 12", () => {
    expect(subscriptionPlanSchema.safeParse({ ...base, intervalCount: "13" }).success).toBe(false);
  });
});

describe("subscriptionSchema", () => {
  it("requires planId and email", () => {
    expect(subscriptionSchema.safeParse({ planId: "", customerName: "X", customerEmail: "x@y.co", startedAt: new Date() }).success).toBe(false);
  });
  it("lowercases email", () => {
    const r = subscriptionSchema.safeParse({ planId: "p", customerName: "X", customerEmail: "X@Y.CO", startedAt: new Date(), quantity: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.customerEmail).toBe("x@y.co");
  });
});

describe("subscriptionUpdateSchema", () => {
  it("rejects quantity 0", () => {
    expect(subscriptionUpdateSchema.safeParse({ customerName: "X", customerEmail: "x@y.co", quantity: "0" }).success).toBe(false);
  });
});

describe("addInterval", () => {
  const start = new Date(Date.UTC(2026, 0, 15)); // Jan 15
  it("adds weeks", () => {
    const d = addInterval(start, "WEEK", 2);
    expect(d.getUTCDate()).toBe(29);
    expect(d.getUTCMonth()).toBe(0);
  });
  it("adds months", () => {
    const d = addInterval(start, "MONTH", 1);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(15);
  });
  it("adds quarters", () => {
    const d = addInterval(start, "QUARTER", 1);
    expect(d.getUTCMonth()).toBe(3);
  });
  it("adds years", () => {
    const d = addInterval(start, "YEAR", 1);
    expect(d.getUTCFullYear()).toBe(2027);
  });
});

describe("computeInitialPeriod", () => {
  const start = new Date(Date.UTC(2026, 0, 1));
  it("ACTIVE when no trial", () => {
    const r = computeInitialPeriod({ startedAt: start, trialDays: 0, interval: "MONTH", intervalCount: 1 });
    expect(r.status).toBe("ACTIVE");
    expect(r.trialEndsAt).toBeNull();
    expect(r.currentPeriodStart).toEqual(start);
    expect(r.currentPeriodEnd.getUTCMonth()).toBe(1);
  });
  it("TRIALING when trialDays > 0", () => {
    const r = computeInitialPeriod({ startedAt: start, trialDays: 14, interval: "MONTH", intervalCount: 1 });
    expect(r.status).toBe("TRIALING");
    expect(r.trialEndsAt).not.toBeNull();
    expect(r.currentPeriodStart.getTime()).toBe(start.getTime() + 14 * 86_400_000);
  });
});

describe("mrrFor", () => {
  it("monthly plan equals price", () => {
    expect(mrrFor({ amount: 29.99, interval: "MONTH", intervalCount: 1, quantity: 1 })).toBeCloseTo(29.99);
  });
  it("yearly plan divides by 12", () => {
    expect(mrrFor({ amount: 120, interval: "YEAR", intervalCount: 1, quantity: 1 })).toBeCloseTo(10);
  });
  it("multiplies by quantity", () => {
    expect(mrrFor({ amount: 10, interval: "MONTH", intervalCount: 1, quantity: 3 })).toBe(30);
  });
  it("quarterly divides by 3", () => {
    expect(mrrFor({ amount: 30, interval: "QUARTER", intervalCount: 1, quantity: 1 })).toBeCloseTo(10);
  });
});

describe("isLiveSubscriptionStatus", () => {
  it("ACTIVE/TRIALING/PAST_DUE are live", () => {
    expect(isLiveSubscriptionStatus("ACTIVE")).toBe(true);
    expect(isLiveSubscriptionStatus("TRIALING")).toBe(true);
    expect(isLiveSubscriptionStatus("PAST_DUE")).toBe(true);
  });
  it("CANCELED/EXPIRED/PAUSED are not live", () => {
    expect(isLiveSubscriptionStatus("CANCELED")).toBe(false);
    expect(isLiveSubscriptionStatus("EXPIRED")).toBe(false);
    expect(isLiveSubscriptionStatus("PAUSED")).toBe(false);
  });
});

describe("isValidSubscriptionTransition", () => {
  it("allows same status", () => {
    expect(isValidSubscriptionTransition("ACTIVE", "ACTIVE")).toBe(true);
  });
  it("forbids EXPIRED -> anything", () => {
    expect(isValidSubscriptionTransition("EXPIRED", "ACTIVE")).toBe(false);
  });
  it("forbids CANCELED -> ACTIVE", () => {
    expect(isValidSubscriptionTransition("CANCELED", "ACTIVE")).toBe(false);
  });
  it("allows ACTIVE -> PAUSED", () => {
    expect(isValidSubscriptionTransition("ACTIVE", "PAUSED")).toBe(true);
  });
  it("allows PAUSED -> ACTIVE", () => {
    expect(isValidSubscriptionTransition("PAUSED", "ACTIVE")).toBe(true);
  });
});

describe("formatInvoiceNumber", () => {
  it("pads to 6 digits", () => {
    expect(formatInvoiceNumber(2026, 7)).toBe("INV-2026-000007");
  });
  it("handles large sequence", () => {
    expect(formatInvoiceNumber(2026, 123456)).toBe("INV-2026-123456");
  });
});
