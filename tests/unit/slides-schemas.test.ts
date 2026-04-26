import { describe, expect, it } from "vitest";
import {
  PRESENTATION_STATUSES,
  PRESENTATION_TRANSITIONS,
  SLIDE_LAYOUTS,
  canTransitionPresentation,
  nextSlidePosition,
  presentationSchema,
  reorderSlides,
  slideSchema,
  summarizePresentations,
} from "@/modules/slides/schemas";

describe("slides constants", () => {
  it("exposes statuses and layouts", () => {
    expect(PRESENTATION_STATUSES).toEqual(["DRAFT", "PUBLISHED", "ARCHIVED"]);
    expect(SLIDE_LAYOUTS).toEqual([
      "TITLE",
      "CONTENT",
      "TWO_COLUMN",
      "QUOTE",
      "IMAGE",
    ]);
  });
});

describe("presentationSchema", () => {
  it("trims and requires title", () => {
    expect(presentationSchema.parse({ title: " Hi " }).title).toBe("Hi");
    expect(() => presentationSchema.parse({ title: "" })).toThrow();
  });
});

describe("slideSchema", () => {
  it("defaults layout and body", () => {
    const r = slideSchema.parse({ title: "S" });
    expect(r.layout).toBe("CONTENT");
    expect(r.body).toBe("");
  });
  it("rejects bad layout", () => {
    expect(() =>
      slideSchema.parse({ title: "S", layout: "BOGUS" }),
    ).toThrow();
  });
});

describe("canTransitionPresentation", () => {
  it("matches the documented matrix", () => {
    expect(PRESENTATION_TRANSITIONS.DRAFT).toEqual(["PUBLISHED"]);
    expect(canTransitionPresentation("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionPresentation("DRAFT", "ARCHIVED")).toBe(false);
    expect(canTransitionPresentation("PUBLISHED", "DRAFT")).toBe(true);
    expect(canTransitionPresentation("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransitionPresentation("ARCHIVED", "DRAFT")).toBe(true);
    expect(canTransitionPresentation("ARCHIVED", "PUBLISHED")).toBe(false);
  });
});

describe("summarizePresentations", () => {
  it("counts by status", () => {
    const r = summarizePresentations([
      { status: "DRAFT" },
      { status: "PUBLISHED" },
      { status: "PUBLISHED" },
    ]);
    expect(r.total).toBe(3);
    expect(r.PUBLISHED).toBe(2);
    expect(r.ARCHIVED).toBe(0);
  });
});

describe("nextSlidePosition", () => {
  it("returns 0 for empty list", () => {
    expect(nextSlidePosition([])).toBe(0);
  });
  it("returns max+1", () => {
    expect(
      nextSlidePosition([{ position: 0 }, { position: 2 }, { position: 1 }]),
    ).toBe(3);
  });
});

describe("reorderSlides", () => {
  const slides = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("moves item earlier", () => {
    const r = reorderSlides(slides, "c", 0);
    expect(r.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
    expect(r.map((x) => x.position)).toEqual([0, 1, 2, 3]);
  });
  it("moves item later", () => {
    const r = reorderSlides(slides, "a", 2);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a", "d"]);
  });
  it("clamps newIndex into range", () => {
    const r = reorderSlides(slides, "a", 99);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "d", "a"]);
  });
  it("returns unchanged ordering when id missing", () => {
    const r = reorderSlides(slides, "missing", 0);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});
