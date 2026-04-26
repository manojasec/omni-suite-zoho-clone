import { describe, it, expect } from "vitest";
import {
  experimentSchema,
  variantsSchema,
  trackEventSchema,
  assignSchema,
  slugifyExperiment,
  assignVariant,
  conversionRate,
  formatRate,
  summarizeEvents,
} from "@/modules/experiments/schemas";

describe("experiments schemas", () => {
  describe("experimentSchema", () => {
    it("accepts a valid experiment", () => {
      const r = experimentSchema.safeParse({ slug: "homepage-cta", name: "Homepage CTA test" });
      expect(r.success).toBe(true);
    });

    it("rejects an invalid slug", () => {
      const r = experimentSchema.safeParse({ slug: "Bad Slug!", name: "x" });
      expect(r.success).toBe(false);
    });

    it("treats empty hypothesis as undefined", () => {
      const r = experimentSchema.safeParse({ slug: "ok", name: "Ok", hypothesis: "" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.hypothesis).toBeUndefined();
    });
  });

  describe("variantsSchema", () => {
    const goodVariants = [
      { key: "control", label: "Control", weight: 50, isControl: true },
      { key: "variant_a", label: "Variant A", weight: 50, isControl: false },
    ];

    it("accepts a valid two-variant test", () => {
      const r = variantsSchema.safeParse(goodVariants);
      expect(r.success).toBe(true);
    });

    it("rejects when weights don't sum to 100", () => {
      const r = variantsSchema.safeParse([
        { key: "a", label: "A", weight: 30, isControl: true },
        { key: "b", label: "B", weight: 30, isControl: false },
      ]);
      expect(r.success).toBe(false);
    });

    it("rejects when no control is set", () => {
      const r = variantsSchema.safeParse([
        { key: "a", label: "A", weight: 50, isControl: false },
        { key: "b", label: "B", weight: 50, isControl: false },
      ]);
      expect(r.success).toBe(false);
    });

    it("rejects when more than one control is set", () => {
      const r = variantsSchema.safeParse([
        { key: "a", label: "A", weight: 50, isControl: true },
        { key: "b", label: "B", weight: 50, isControl: true },
      ]);
      expect(r.success).toBe(false);
    });

    it("rejects fewer than two variants", () => {
      const r = variantsSchema.safeParse([
        { key: "a", label: "A", weight: 100, isControl: true },
      ]);
      expect(r.success).toBe(false);
    });

    it("rejects duplicate keys", () => {
      const r = variantsSchema.safeParse([
        { key: "a", label: "A", weight: 50, isControl: true },
        { key: "a", label: "A2", weight: 50, isControl: false },
      ]);
      expect(r.success).toBe(false);
    });
  });

  describe("trackEventSchema", () => {
    it("accepts a VIEW with no value", () => {
      const r = trackEventSchema.safeParse({
        visitorId: "visitor-12345",
        variantKey: "control",
        kind: "VIEW",
      });
      expect(r.success).toBe(true);
    });

    it("rejects too-short visitor ids", () => {
      const r = trackEventSchema.safeParse({
        visitorId: "abc",
        variantKey: "control",
        kind: "VIEW",
      });
      expect(r.success).toBe(false);
    });

    it("rejects unknown kinds", () => {
      const r = trackEventSchema.safeParse({
        visitorId: "visitor-12345",
        variantKey: "control",
        kind: "BOGUS",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("assignSchema", () => {
    it("accepts a valid visitor id", () => {
      const r = assignSchema.safeParse({ visitorId: "visitor-12345" });
      expect(r.success).toBe(true);
    });

    it("rejects an empty visitor id", () => {
      const r = assignSchema.safeParse({ visitorId: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("slugifyExperiment", () => {
    it("lowercases and dashes spaces", () => {
      expect(slugifyExperiment("Homepage CTA Test!")).toBe("homepage-cta-test");
    });

    it("caps at 80 chars", () => {
      expect(slugifyExperiment("a".repeat(200)).length).toBe(80);
    });
  });

  describe("assignVariant", () => {
    const variants = [
      { key: "control", weight: 50 },
      { key: "variant_a", weight: 50 },
    ];

    it("returns the same variant for the same visitor (sticky)", () => {
      const a = assignVariant("exp1", "visitor-abcd1234", variants);
      const b = assignVariant("exp1", "visitor-abcd1234", variants);
      expect(a).toBe(b);
    });

    it("respects weight allocation roughly across many visitors", () => {
      const counts: Record<string, number> = { control: 0, variant_a: 0 };
      for (let i = 0; i < 1000; i += 1) {
        const k = assignVariant("exp1", `visitor-${i}`, variants);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      // Allow generous tolerance: ±15% of 500 each.
      expect(counts.control).toBeGreaterThan(350);
      expect(counts.control).toBeLessThan(650);
      expect(counts.variant_a).toBeGreaterThan(350);
      expect(counts.variant_a).toBeLessThan(650);
    });

    it("always returns the control when weight is 100/0", () => {
      const skewed = [
        { key: "control", weight: 100 },
        { key: "variant_a", weight: 0 },
      ];
      for (let i = 0; i < 50; i += 1) {
        expect(assignVariant("exp1", `v-${i}-padding`, skewed)).toBe("control");
      }
    });
  });

  describe("conversionRate / formatRate", () => {
    it("returns 0 when views is 0", () => {
      expect(conversionRate(0, 5)).toBe(0);
    });

    it("clamps to [0,1]", () => {
      expect(conversionRate(10, 50)).toBe(1);
    });

    it("formats as percent with 1 decimal", () => {
      expect(formatRate(0.123)).toBe("12.3%");
      expect(formatRate(0)).toBe("0.0%");
    });
  });

  describe("summarizeEvents", () => {
    it("aggregates per-variant views and conversions", () => {
      const out = summarizeEvents([
        { variantKey: "control", kind: "VIEW" },
        { variantKey: "control", kind: "VIEW" },
        { variantKey: "control", kind: "CONVERSION" },
        { variantKey: "variant_a", kind: "VIEW" },
        { variantKey: "variant_a", kind: "CONVERSION" },
        { variantKey: "variant_a", kind: "CONVERSION" },
      ]);
      expect(out.control).toEqual({ views: 2, conversions: 1, rate: 0.5 });
      expect(out.variant_a).toEqual({ views: 1, conversions: 2, rate: 1 });
    });

    it("returns empty for no events", () => {
      expect(summarizeEvents([])).toEqual({});
    });
  });
});
