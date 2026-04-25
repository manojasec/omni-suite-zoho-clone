import { describe, it, expect } from "vitest";
import { ORDERED_PLANS, PLANS, getPlan } from "@/modules/billing/plans";
import { planForPriceId } from "@/lib/stripe";

describe("plans catalog", () => {
  it("exposes 4 plans in order Free → Enterprise", () => {
    expect(ORDERED_PLANS.map((p) => p.key)).toEqual([
      "FREE",
      "STARTER",
      "PROFESSIONAL",
      "ENTERPRISE",
    ]);
  });

  it("ENTERPRISE has unlimited limits", () => {
    expect(PLANS.ENTERPRISE.limits.users).toBe(-1);
    expect(PLANS.ENTERPRISE.limits.contacts).toBe(-1);
  });

  it("FREE is free and lacks advanced features", () => {
    expect(PLANS.FREE.priceMonthly).toBe(0);
    expect(PLANS.FREE.features.advancedReports).toBe(false);
    expect(PLANS.FREE.features.sso).toBe(false);
  });

  it("higher plans cost more than lower plans", () => {
    expect(PLANS.STARTER.priceMonthly).toBeLessThan(PLANS.PROFESSIONAL.priceMonthly);
    expect(PLANS.PROFESSIONAL.priceMonthly).toBeLessThan(PLANS.ENTERPRISE.priceMonthly);
  });

  it("getPlan returns FREE definition for FREE key", () => {
    expect(getPlan("FREE").key).toBe("FREE");
  });
});

describe("planForPriceId", () => {
  it("returns FREE when priceId is unknown / missing", () => {
    expect(planForPriceId(null)).toBe("FREE");
    expect(planForPriceId(undefined)).toBe("FREE");
    expect(planForPriceId("price_unknown")).toBe("FREE");
  });

  it("maps configured Stripe price IDs to internal plans", () => {
    process.env.STRIPE_PRICE_STARTER = "price_starter";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_pro";
    process.env.STRIPE_PRICE_ENTERPRISE = "price_ent";
    expect(planForPriceId("price_starter")).toBe("STARTER");
    expect(planForPriceId("price_pro")).toBe("PROFESSIONAL");
    expect(planForPriceId("price_ent")).toBe("ENTERPRISE");
  });
});
