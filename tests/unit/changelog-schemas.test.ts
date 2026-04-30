import { describe, expect, it } from "vitest";
import {
  changelogEntrySchema,
  entrySlugSchema,
  entryTypeColor,
  formatEntryType,
  groupEntriesByMonth,
  slugifyTitle,
} from "@/modules/changelog/schemas";

describe("slugifyTitle", () => {
  it("converts a title to a slug", () => {
    expect(slugifyTitle("New Feature: Faster Search!")).toBe("new-feature-faster-search");
  });

  it("strips diacritics", () => {
    expect(slugifyTitle("Café Mode")).toBe("cafe-mode");
  });

  it("returns empty for empty input", () => {
    expect(slugifyTitle("")).toBe("");
  });

  it("caps length at 200 characters", () => {
    expect(slugifyTitle("a".repeat(400)).length).toBe(200);
  });

  it("trims leading/trailing dashes", () => {
    expect(slugifyTitle("---hello world---")).toBe("hello-world");
  });
});

describe("entrySlugSchema", () => {
  it("accepts a valid slug", () => {
    expect(entrySlugSchema.parse("v2-launch")).toBe("v2-launch");
  });

  it("rejects empty", () => {
    expect(entrySlugSchema.safeParse("").success).toBe(false);
  });

  it("rejects uppercase or spaces", () => {
    expect(entrySlugSchema.safeParse("V2 Launch").success).toBe(false);
  });
});

describe("changelogEntrySchema", () => {
  const base = {
    title: "Faster search",
    slug: "faster-search",
    body: "We've made global search 3x faster.",
    type: "IMPROVEMENT" as const,
    status: "DRAFT" as const,
  };

  it("accepts a complete entry", () => {
    expect(changelogEntrySchema.safeParse(base).success).toBe(true);
  });

  it("requires a title and body", () => {
    expect(changelogEntrySchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(changelogEntrySchema.safeParse({ ...base, body: "" }).success).toBe(false);
  });

  it("rejects unknown type or status", () => {
    expect(changelogEntrySchema.safeParse({ ...base, type: "MYSTERY" }).success).toBe(
      false,
    );
    expect(
      changelogEntrySchema.safeParse({ ...base, status: "ARCHIVED" }).success,
    ).toBe(false);
  });

  it("caps body length at 50000 characters", () => {
    expect(
      changelogEntrySchema.safeParse({ ...base, body: "x".repeat(50_001) }).success,
    ).toBe(false);
  });
});

describe("formatEntryType", () => {
  it("maps each type to a label", () => {
    expect(formatEntryType("FEATURE")).toBe("New");
    expect(formatEntryType("IMPROVEMENT")).toBe("Improved");
    expect(formatEntryType("FIX")).toBe("Fixed");
    expect(formatEntryType("ANNOUNCEMENT")).toBe("Announcement");
  });
});

describe("entryTypeColor", () => {
  it("returns a color class for each type", () => {
    expect(entryTypeColor("FEATURE")).toMatch(/emerald/);
    expect(entryTypeColor("IMPROVEMENT")).toMatch(/blue/);
    expect(entryTypeColor("FIX")).toMatch(/amber/);
    expect(entryTypeColor("ANNOUNCEMENT")).toMatch(/purple/);
  });
});

describe("groupEntriesByMonth", () => {
  it("returns an empty array for empty input", () => {
    expect(groupEntriesByMonth([])).toEqual([]);
  });

  it("groups entries into month buckets and sorts newest first", () => {
    const e1 = {
      publishedAt: new Date("2025-03-15T00:00:00Z"),
      createdAt: new Date("2025-03-15T00:00:00Z"),
    };
    const e2 = {
      publishedAt: new Date("2025-03-22T00:00:00Z"),
      createdAt: new Date("2025-03-22T00:00:00Z"),
    };
    const e3 = {
      publishedAt: new Date("2025-04-02T00:00:00Z"),
      createdAt: new Date("2025-04-02T00:00:00Z"),
    };
    const groups = groupEntriesByMonth([e1, e2, e3]);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2025-04");
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[1].key).toBe("2025-03");
    expect(groups[1].entries).toHaveLength(2);
  });

  it("falls back to createdAt when publishedAt is null", () => {
    const e = { publishedAt: null, createdAt: new Date("2025-01-10T00:00:00Z") };
    const groups = groupEntriesByMonth([e]);
    expect(groups[0].key).toBe("2025-01");
  });
});
