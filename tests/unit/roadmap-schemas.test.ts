import { describe, expect, it } from "vitest";
import {
  ROADMAP_STATUSES,
  formatRoadmapStatus,
  groupItemsByStatus,
  roadmapItemSchema,
  roadmapStatusColor,
  voteEmailSchema,
} from "@/modules/roadmap/schemas";

describe("roadmapItemSchema", () => {
  const base = {
    title: "Dark mode",
    description: "Add a dark theme toggle.",
    category: "ui",
    status: "PLANNED" as const,
    isPublic: true,
  };

  it("accepts a complete item", () => {
    expect(roadmapItemSchema.safeParse(base).success).toBe(true);
  });

  it("requires a title", () => {
    expect(roadmapItemSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(
      roadmapItemSchema.safeParse({ ...base, status: "ARCHIVED" }).success,
    ).toBe(false);
  });

  it("defaults status to PLANNED and isPublic to true", () => {
    const parsed = roadmapItemSchema.parse({ title: "X" });
    expect(parsed.status).toBe("PLANNED");
    expect(parsed.isPublic).toBe(true);
  });

  it("caps description at 5000 characters", () => {
    expect(
      roadmapItemSchema.safeParse({ ...base, description: "x".repeat(5_001) }).success,
    ).toBe(false);
  });
});

describe("voteEmailSchema", () => {
  it("accepts a valid email and lowercases it", () => {
    expect(voteEmailSchema.parse(" Foo@Example.COM ")).toBe("foo@example.com");
  });

  it("rejects an invalid email", () => {
    expect(voteEmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(voteEmailSchema.safeParse("").success).toBe(false);
  });
});

describe("formatRoadmapStatus", () => {
  it("maps each status", () => {
    expect(formatRoadmapStatus("PLANNED")).toBe("Planned");
    expect(formatRoadmapStatus("IN_PROGRESS")).toBe("In progress");
    expect(formatRoadmapStatus("SHIPPED")).toBe("Shipped");
  });

  it("falls back to raw value for unknown", () => {
    expect(formatRoadmapStatus("MYSTERY")).toBe("MYSTERY");
  });
});

describe("roadmapStatusColor", () => {
  it("returns distinct color classes", () => {
    const classes = ROADMAP_STATUSES.map(roadmapStatusColor);
    expect(new Set(classes).size).toBe(3);
  });
});

describe("groupItemsByStatus", () => {
  const mk = (
    status: "PLANNED" | "IN_PROGRESS" | "SHIPPED",
    voteCount: number,
    title: string,
    position = 0,
  ) => ({ status, voteCount, position, title });

  it("returns empty buckets for empty input", () => {
    const g = groupItemsByStatus([]);
    expect(g.PLANNED).toEqual([]);
    expect(g.IN_PROGRESS).toEqual([]);
    expect(g.SHIPPED).toEqual([]);
  });

  it("buckets items by status", () => {
    const g = groupItemsByStatus([
      mk("PLANNED", 0, "a"),
      mk("IN_PROGRESS", 0, "b"),
      mk("SHIPPED", 0, "c"),
    ]);
    expect(g.PLANNED).toHaveLength(1);
    expect(g.IN_PROGRESS).toHaveLength(1);
    expect(g.SHIPPED).toHaveLength(1);
  });

  it("sorts by voteCount desc then position then title", () => {
    const g = groupItemsByStatus([
      mk("PLANNED", 1, "low"),
      mk("PLANNED", 5, "high"),
      mk("PLANNED", 5, "alpha"),
    ]);
    expect(g.PLANNED.map((x) => x.title)).toEqual(["alpha", "high", "low"]);
  });
});
