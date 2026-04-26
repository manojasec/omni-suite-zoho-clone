import { describe, expect, it } from "vitest";
import { colorClass, NOTE_COLORS, notebookSchema, noteSchema } from "@/modules/notes/schemas";

describe("notebookSchema", () => {
  it("requires non-empty name", () => {
    expect(notebookSchema.safeParse({ name: "", color: "slate" }).success).toBe(false);
  });
  it("rejects unknown color", () => {
    expect(notebookSchema.safeParse({ name: "Work", color: "neon" }).success).toBe(false);
  });
  it("defaults color to slate when missing", () => {
    const r = notebookSchema.safeParse({ name: "Work" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.color).toBe("slate");
  });
  it("accepts all NOTE_COLORS", () => {
    for (const c of NOTE_COLORS) {
      expect(notebookSchema.safeParse({ name: "X", color: c }).success).toBe(true);
    }
  });
});

describe("noteSchema", () => {
  it("requires title", () => {
    expect(noteSchema.safeParse({ title: "", content: "" }).success).toBe(false);
  });
  it("trims notebookId empty string to undefined", () => {
    const r = noteSchema.safeParse({ title: "T", content: "", notebookId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notebookId).toBeUndefined();
  });
  it("defaults content to empty string", () => {
    const r = noteSchema.safeParse({ title: "T" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.content).toBe("");
  });
  it("rejects content over 50000 chars", () => {
    const r = noteSchema.safeParse({ title: "T", content: "a".repeat(50001) });
    expect(r.success).toBe(false);
  });
  it("rejects title over 200 chars", () => {
    const r = noteSchema.safeParse({ title: "x".repeat(201), content: "" });
    expect(r.success).toBe(false);
  });
});

describe("colorClass", () => {
  it("returns default slate classes for unknown color", () => {
    expect(colorClass("nonsense")).toContain("slate");
  });
  it("returns rose classes for rose", () => {
    expect(colorClass("rose")).toContain("rose");
  });
});
