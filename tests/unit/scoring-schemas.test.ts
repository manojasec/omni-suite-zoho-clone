import { describe, it, expect } from "vitest";
import {
  ruleSchema,
  manualEventSchema,
  scoreBucket,
  scoreBucketClass,
  sumPoints,
  DEFAULT_POINTS,
  EVENT_TYPE_LABELS,
  LEAD_SCORE_EVENT_TYPES,
} from "@/modules/scoring/schemas";

describe("scoring schemas", () => {
  describe("ruleSchema", () => {
    it("accepts a valid rule with coerced numeric points", () => {
      const r = ruleSchema.safeParse({
        name: "Pricing click",
        eventType: "EMAIL_CLICKED",
        points: "5",
        active: true,
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.points).toBe(5);
    });

    it("rejects an unknown event type", () => {
      const r = ruleSchema.safeParse({ name: "x", eventType: "BOGUS", points: 1 });
      expect(r.success).toBe(false);
    });

    it("rejects an empty name", () => {
      const r = ruleSchema.safeParse({ name: "  ", eventType: "EMAIL_OPENED", points: 1 });
      expect(r.success).toBe(false);
    });

    it("rejects out-of-range points", () => {
      const r = ruleSchema.safeParse({ name: "x", eventType: "EMAIL_OPENED", points: 99999 });
      expect(r.success).toBe(false);
    });
  });

  describe("manualEventSchema", () => {
    it("rejects zero points", () => {
      const r = manualEventSchema.safeParse({ contactId: "abc", points: 0 });
      expect(r.success).toBe(false);
    });

    it("treats empty reason as undefined", () => {
      const r = manualEventSchema.safeParse({ contactId: "abc", points: 5, reason: "" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.reason).toBeUndefined();
    });

    it("accepts negative adjustments", () => {
      const r = manualEventSchema.safeParse({ contactId: "abc", points: -3 });
      expect(r.success).toBe(true);
    });
  });

  describe("scoreBucket", () => {
    it("returns cold for low scores", () => {
      expect(scoreBucket(0)).toBe("cold");
      expect(scoreBucket(19)).toBe("cold");
    });

    it("returns warm at 20+", () => {
      expect(scoreBucket(20)).toBe("warm");
      expect(scoreBucket(49)).toBe("warm");
    });

    it("returns hot at 50+", () => {
      expect(scoreBucket(50)).toBe("hot");
      expect(scoreBucket(120)).toBe("hot");
    });

    it("treats negatives as cold", () => {
      expect(scoreBucket(-10)).toBe("cold");
    });
  });

  describe("scoreBucketClass", () => {
    it("returns rose for hot", () => {
      expect(scoreBucketClass(80)).toMatch(/rose/);
    });

    it("returns amber for warm", () => {
      expect(scoreBucketClass(30)).toMatch(/amber/);
    });

    it("returns zinc for cold", () => {
      expect(scoreBucketClass(0)).toMatch(/zinc/);
    });
  });

  describe("sumPoints", () => {
    it("sums an empty list to 0", () => {
      expect(sumPoints([])).toBe(0);
    });

    it("sums positive and negative values", () => {
      expect(sumPoints([{ points: 10 }, { points: -3 }, { points: 5 }])).toBe(12);
    });

    it("ignores non-finite points", () => {
      expect(sumPoints([{ points: 5 }, { points: NaN as unknown as number }])).toBe(5);
    });
  });

  describe("metadata tables", () => {
    it("DEFAULT_POINTS covers every event type", () => {
      for (const t of LEAD_SCORE_EVENT_TYPES) {
        expect(DEFAULT_POINTS[t]).toBeDefined();
      }
    });

    it("EVENT_TYPE_LABELS covers every event type", () => {
      for (const t of LEAD_SCORE_EVENT_TYPES) {
        expect(EVENT_TYPE_LABELS[t]).toBeTruthy();
      }
    });
  });
});
