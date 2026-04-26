import { describe, it, expect } from "vitest";
import {
  courseSchema,
  lessonSchema,
  enrollSchema,
  reorderSchema,
  slugifyCourse,
  progressPercent,
  isFullyComplete,
  totalDurationMinutes,
  formatDuration,
} from "@/modules/learn/schemas";

describe("learn schemas", () => {
  describe("courseSchema", () => {
    it("accepts a valid course", () => {
      const r = courseSchema.safeParse({ slug: "sales-onboarding", title: "Sales onboarding" });
      expect(r.success).toBe(true);
    });

    it("rejects an invalid slug", () => {
      const r = courseSchema.safeParse({ slug: "Bad Slug!", title: "x" });
      expect(r.success).toBe(false);
    });

    it("treats empty optionals as undefined", () => {
      const r = courseSchema.safeParse({
        slug: "ok",
        title: "Ok",
        summary: "",
        description: "",
        coverImageUrl: "",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.summary).toBeUndefined();
        expect(r.data.description).toBeUndefined();
        expect(r.data.coverImageUrl).toBeUndefined();
      }
    });

    it("rejects empty title", () => {
      const r = courseSchema.safeParse({ slug: "ok", title: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("lessonSchema", () => {
    it("coerces duration from string", () => {
      const r = lessonSchema.safeParse({ title: "Intro", durationMinutes: "15" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.durationMinutes).toBe(15);
    });

    it("defaults duration to 0 when omitted", () => {
      const r = lessonSchema.safeParse({ title: "Intro" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.durationMinutes).toBe(0);
    });

    it("rejects negative duration", () => {
      const r = lessonSchema.safeParse({ title: "Intro", durationMinutes: -5 });
      expect(r.success).toBe(false);
    });

    it("rejects empty title", () => {
      const r = lessonSchema.safeParse({ title: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("enrollSchema", () => {
    it("lowercases and trims email", () => {
      const r = enrollSchema.safeParse({
        learnerEmail: "  Jane@Example.COM  ",
        learnerName: "Jane",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.learnerEmail).toBe("jane@example.com");
    });

    it("rejects invalid email", () => {
      const r = enrollSchema.safeParse({ learnerEmail: "not-an-email", learnerName: "X" });
      expect(r.success).toBe(false);
    });

    it("rejects empty name", () => {
      const r = enrollSchema.safeParse({ learnerEmail: "a@b.com", learnerName: "" });
      expect(r.success).toBe(false);
    });
  });

  describe("reorderSchema", () => {
    it("accepts up", () => {
      expect(reorderSchema.safeParse({ direction: "up" }).success).toBe(true);
    });
    it("rejects unknown direction", () => {
      expect(reorderSchema.safeParse({ direction: "sideways" }).success).toBe(false);
    });
  });

  describe("slugifyCourse", () => {
    it("lowercases and dashes spaces", () => {
      expect(slugifyCourse("Sales Onboarding 101!")).toBe("sales-onboarding-101");
    });
    it("strips leading/trailing dashes", () => {
      expect(slugifyCourse("  --hello-- ")).toBe("hello");
    });
    it("caps at 80 chars", () => {
      expect(slugifyCourse("a".repeat(200)).length).toBe(80);
    });
  });

  describe("progressPercent", () => {
    it("returns 0 when total is 0", () => {
      expect(progressPercent(0, 0)).toBe(0);
      expect(progressPercent(5, 0)).toBe(0);
    });
    it("rounds to nearest integer", () => {
      expect(progressPercent(1, 3)).toBe(33);
      expect(progressPercent(2, 3)).toBe(67);
    });
    it("clamps to 100", () => {
      expect(progressPercent(10, 5)).toBe(100);
    });
    it("clamps to 0 for negatives", () => {
      expect(progressPercent(-1, 10)).toBe(0);
    });
  });

  describe("isFullyComplete", () => {
    it("true when completed >= total > 0", () => {
      expect(isFullyComplete(3, 3)).toBe(true);
      expect(isFullyComplete(4, 3)).toBe(true);
    });
    it("false when total is 0", () => {
      expect(isFullyComplete(0, 0)).toBe(false);
    });
    it("false when not yet finished", () => {
      expect(isFullyComplete(2, 3)).toBe(false);
    });
  });

  describe("totalDurationMinutes", () => {
    it("sums lesson durations", () => {
      expect(
        totalDurationMinutes([
          { durationMinutes: 10 },
          { durationMinutes: 15 },
          { durationMinutes: 5 },
        ]),
      ).toBe(30);
    });
    it("ignores non-positive and non-finite values", () => {
      expect(
        totalDurationMinutes([
          { durationMinutes: 10 },
          { durationMinutes: 0 },
          { durationMinutes: -5 },
          { durationMinutes: Number.NaN },
        ]),
      ).toBe(10);
    });
    it("returns 0 for empty list", () => {
      expect(totalDurationMinutes([])).toBe(0);
    });
  });

  describe("formatDuration", () => {
    it("formats minutes only", () => {
      expect(formatDuration(45)).toBe("45m");
    });
    it("formats whole hours", () => {
      expect(formatDuration(120)).toBe("2h");
    });
    it("formats hours + minutes", () => {
      expect(formatDuration(75)).toBe("1h 15m");
    });
    it("returns 0m for zero or negative", () => {
      expect(formatDuration(0)).toBe("0m");
      expect(formatDuration(-10)).toBe("0m");
    });
  });
});
