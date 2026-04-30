import { describe, expect, it } from "vitest";
import {
  filterArticlesByQuery,
  groupArticlesByCategory,
  pickPopularArticles,
} from "@/modules/help/public";

const article = (
  id: string,
  title: string,
  excerpt: string | null,
  views: number,
  publishedAt: Date | null = new Date("2025-04-01T00:00:00Z"),
  categoryId: string | null = null,
) => ({ id, title, excerpt, views, publishedAt, categoryId });

describe("filterArticlesByQuery", () => {
  const all = [
    article("a", "Getting Started with Billing", null, 0),
    article("b", "Reset your password", "How to reset your account password", 0),
    article("c", "Webhooks", "Configure webhook endpoints for event delivery", 0),
  ];

  it("returns all articles for empty query", () => {
    expect(filterArticlesByQuery(all, "")).toHaveLength(3);
    expect(filterArticlesByQuery(all, "   ")).toHaveLength(3);
  });

  it("matches case-insensitively on title", () => {
    const r = filterArticlesByQuery(all, "BILLING");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("a");
  });

  it("matches on excerpt when title does not match", () => {
    const r = filterArticlesByQuery(all, "endpoints");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("c");
  });

  it("ranks title hits ahead of excerpt hits", () => {
    const r = filterArticlesByQuery(
      [
        article("x", "Other topic", "password info", 0),
        article("y", "Password recovery", null, 0),
      ],
      "password",
    );
    expect(r.map((a) => a.id)).toEqual(["y", "x"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterArticlesByQuery(all, "zzz")).toEqual([]);
  });
});

describe("groupArticlesByCategory", () => {
  it("groups by categoryId and uses uncategorized bucket for nulls", () => {
    const grouped = groupArticlesByCategory([
      article("a", "T1", null, 0, null, "cat1"),
      article("b", "T2", null, 0, null, "cat1"),
      article("c", "T3", null, 0, null, null),
    ]);
    expect(grouped["cat1"]).toHaveLength(2);
    expect(grouped["__uncategorized"]).toHaveLength(1);
  });
});

describe("pickPopularArticles", () => {
  it("excludes drafts and orders by views desc", () => {
    const r = pickPopularArticles(
      [
        article("a", "T1", null, 5),
        article("b", "T2", null, 99, null), // draft (no publishedAt)
        article("c", "T3", null, 12),
      ],
      10,
    );
    expect(r.map((a) => a.id)).toEqual(["c", "a"]);
  });

  it("breaks ties by publishedAt desc", () => {
    const r = pickPopularArticles(
      [
        article("old", "T1", null, 5, new Date("2025-01-01T00:00:00Z")),
        article("new", "T2", null, 5, new Date("2025-04-01T00:00:00Z")),
      ],
      10,
    );
    expect(r.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("respects limit", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      article(`a${i}`, "T", null, i),
    );
    expect(pickPopularArticles(items, 3)).toHaveLength(3);
  });

  it("returns empty array for limit 0", () => {
    expect(pickPopularArticles([article("a", "T", null, 1)], 0)).toEqual([]);
  });
});
