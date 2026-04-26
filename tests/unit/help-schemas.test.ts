import { describe, expect, it } from "vitest";
import {
  KB_ARTICLE_STATUSES,
  KB_ARTICLE_TRANSITIONS,
  buildCategoryTree,
  canTransitionArticle,
  isCategoryDescendant,
  kbArticleSchema,
  kbCategorySchema,
  slugify,
  summarizeArticles,
} from "@/modules/help/schemas";

describe("kb constants", () => {
  it("exposes statuses", () => {
    expect(KB_ARTICLE_STATUSES).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
  });
});

describe("slugify", () => {
  it("normalizes strings", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  Spaces   here  ")).toBe("spaces-here");
    expect(slugify("Café & Crème")).toBe("cafe-creme");
    expect(slugify("---weird___chars***")).toBe("weird-chars");
  });
  it("returns empty for empty", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("kbCategorySchema", () => {
  it("auto-generates slug from name", () => {
    const r = kbCategorySchema.parse({ name: "Getting Started" });
    expect(r.slug).toBe("getting-started");
  });
  it("uses provided slug when valid", () => {
    const r = kbCategorySchema.parse({
      name: "Hi",
      slug: "custom-slug",
    });
    expect(r.slug).toBe("custom-slug");
  });
  it("rejects invalid slug characters", () => {
    expect(() =>
      kbCategorySchema.parse({ name: "X", slug: "Bad Slug!" }),
    ).toThrow();
  });
  it("normalizes empty parentId to undefined", () => {
    const r = kbCategorySchema.parse({ name: "X", parentId: "" });
    expect(r.parentId).toBeUndefined();
  });
});

describe("kbArticleSchema", () => {
  it("defaults body and auto-slugs from title", () => {
    const r = kbArticleSchema.parse({ title: "Hello world" });
    expect(r.slug).toBe("hello-world");
    expect(r.body).toBe("");
  });
  it("requires title", () => {
    expect(() => kbArticleSchema.parse({ title: "" })).toThrow();
  });
});

describe("canTransitionArticle", () => {
  it("matches the documented matrix", () => {
    expect(KB_ARTICLE_TRANSITIONS.DRAFT).toEqual(["PUBLISHED"]);
    expect(canTransitionArticle("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionArticle("DRAFT", "ARCHIVED")).toBe(false);
    expect(canTransitionArticle("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransitionArticle("ARCHIVED", "DRAFT")).toBe(true);
    expect(canTransitionArticle("ARCHIVED", "PUBLISHED")).toBe(false);
  });
});

describe("summarizeArticles", () => {
  it("counts by status", () => {
    const r = summarizeArticles([
      { status: "DRAFT" },
      { status: "PUBLISHED" },
      { status: "PUBLISHED" },
      { status: "ARCHIVED" },
    ]);
    expect(r.total).toBe(4);
    expect(r.PUBLISHED).toBe(2);
  });
});

describe("buildCategoryTree", () => {
  it("builds nested tree sorted alphabetically", () => {
    const tree = buildCategoryTree([
      { id: "b", name: "B", slug: "b", parentId: null },
      { id: "a", name: "A", slug: "a", parentId: null },
      { id: "a2", name: "A2", slug: "a2", parentId: "a" },
      { id: "a1", name: "A1", slug: "a1", parentId: "a" },
    ]);
    expect(tree.map((n) => n.name)).toEqual(["A", "B"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["A1", "A2"]);
  });
});

describe("isCategoryDescendant", () => {
  const rows = [
    { id: "root", parentId: null },
    { id: "a", parentId: "root" },
    { id: "a1", parentId: "a" },
    { id: "b", parentId: "root" },
  ];
  it("detects same id and indirect descendants", () => {
    expect(isCategoryDescendant(rows, "root", "root")).toBe(true);
    expect(isCategoryDescendant(rows, "root", "a1")).toBe(true);
    expect(isCategoryDescendant(rows, "a", "a1")).toBe(true);
    expect(isCategoryDescendant(rows, "b", "a1")).toBe(false);
    expect(isCategoryDescendant(rows, "a1", "a")).toBe(false);
  });
});
