import { describe, expect, it } from "vitest";
import {
  WRITER_DOC_STATUSES,
  WRITER_DOC_TRANSITIONS,
  WRITER_DOC_VISIBILITIES,
  buildFolderTree,
  canTransitionDoc,
  countWords,
  diffWordCount,
  formatReadingTime,
  isDescendant,
  readingTimeMinutes,
  summarizeDocs,
  writerDocSchema,
  writerFolderSchema,
} from "@/modules/writer/schemas";

describe("writer constants", () => {
  it("exposes statuses and visibilities", () => {
    expect(WRITER_DOC_STATUSES).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
    expect(WRITER_DOC_VISIBILITIES).toEqual(["PRIVATE", "WORKSPACE", "PUBLIC"]);
  });
});

describe("writerFolderSchema", () => {
  it("requires a name", () => {
    expect(() => writerFolderSchema.parse({ name: "" })).toThrow();
  });
  it("normalizes empty parentId to undefined", () => {
    const r = writerFolderSchema.parse({ name: "Notes", parentId: "" });
    expect(r.parentId).toBeUndefined();
  });
});

describe("writerDocSchema", () => {
  it("defaults status, visibility, and content", () => {
    const r = writerDocSchema.parse({ title: "Hello" });
    expect(r.status).toBe("DRAFT");
    expect(r.visibility).toBe("WORKSPACE");
    expect(r.content).toBe("");
  });
  it("requires a title", () => {
    expect(() => writerDocSchema.parse({ title: "" })).toThrow();
  });
});

describe("transitions", () => {
  it("matches the documented matrix", () => {
    expect(WRITER_DOC_TRANSITIONS.DRAFT).toEqual(["PUBLISHED"]);
    expect(canTransitionDoc("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionDoc("DRAFT", "ARCHIVED")).toBe(false);
    expect(canTransitionDoc("PUBLISHED", "DRAFT")).toBe(true);
    expect(canTransitionDoc("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransitionDoc("ARCHIVED", "DRAFT")).toBe(true);
    expect(canTransitionDoc("ARCHIVED", "PUBLISHED")).toBe(false);
  });
});

describe("countWords", () => {
  it("counts simple words", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("   one    two three  ")).toBe(3);
  });
  it("strips simple HTML tags", () => {
    expect(countWords("<p>hello <strong>brave</strong> world</p>")).toBe(3);
  });
  it("returns 0 for empty input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("readingTimeMinutes / formatReadingTime", () => {
  it("formats reading time", () => {
    expect(readingTimeMinutes(0)).toBe(0);
    expect(readingTimeMinutes(50)).toBe(1);
    expect(readingTimeMinutes(400)).toBe(2);
    expect(formatReadingTime(0)).toBe("—");
    expect(formatReadingTime(800)).toBe("4 min read");
  });
});

describe("diffWordCount", () => {
  it("returns delta", () => {
    expect(diffWordCount("a b", "a b c d")).toBe(2);
    expect(diffWordCount("a b c", "a")).toBe(-2);
  });
});

describe("summarizeDocs", () => {
  it("counts by status", () => {
    const r = summarizeDocs([
      { status: "DRAFT" },
      { status: "DRAFT" },
      { status: "PUBLISHED" },
      { status: "ARCHIVED" },
    ]);
    expect(r.total).toBe(4);
    expect(r.DRAFT).toBe(2);
    expect(r.PUBLISHED).toBe(1);
  });
});

describe("buildFolderTree", () => {
  it("builds hierarchical structure sorted by name", () => {
    const tree = buildFolderTree([
      { id: "b", name: "B", parentId: null },
      { id: "a", name: "A", parentId: null },
      { id: "a1", name: "A1", parentId: "a" },
      { id: "a2", name: "A2", parentId: "a" },
    ]);
    expect(tree.map((n) => n.name)).toEqual(["A", "B"]);
    expect(tree[0].children.map((n) => n.name)).toEqual(["A1", "A2"]);
  });

  it("treats unknown parentIds as roots", () => {
    const tree = buildFolderTree([{ id: "x", name: "X", parentId: "ghost" }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("x");
  });
});

describe("isDescendant", () => {
  const folders = [
    { id: "root", parentId: null },
    { id: "a", parentId: "root" },
    { id: "a1", parentId: "a" },
    { id: "b", parentId: "root" },
  ];
  it("detects same-id and direct/indirect descendants", () => {
    expect(isDescendant(folders, "root", "root")).toBe(true);
    expect(isDescendant(folders, "root", "a1")).toBe(true);
    expect(isDescendant(folders, "a", "a1")).toBe(true);
    expect(isDescendant(folders, "b", "a1")).toBe(false);
    expect(isDescendant(folders, "a1", "a")).toBe(false);
  });
});
