import { describe, expect, it } from "vitest";
import {
  questionSchema,
  summarizeAnswers,
  surveySchema,
  validateAnswer,
} from "@/modules/surveys/schemas";

describe("surveySchema", () => {
  it("requires title", () => {
    expect(surveySchema.safeParse({ title: "", description: "" }).success).toBe(false);
  });
  it("coerces empty closesAt to undefined", () => {
    const r = surveySchema.safeParse({ title: "Q", description: "", thankYouText: "", closesAt: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.closesAt).toBeUndefined();
  });
  it("parses closesAt iso string to Date", () => {
    const r = surveySchema.safeParse({ title: "Q", closesAt: "2026-12-31T00:00:00Z" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.closesAt).toBeInstanceOf(Date);
  });
});

describe("questionSchema", () => {
  it("splits options on newlines", () => {
    const r = questionSchema.safeParse({
      type: "SINGLE_CHOICE",
      prompt: "Pick",
      optionsText: "A\nB\n  C  \n",
      ratingMax: "5",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.options).toEqual(["A", "B", "C"]);
  });
  it("requires at least 2 options for choice questions", () => {
    const r = questionSchema.safeParse({ type: "SINGLE_CHOICE", prompt: "Pick", optionsText: "A", ratingMax: "5" });
    expect(r.success).toBe(false);
  });
  it("does not require options for text questions", () => {
    const r = questionSchema.safeParse({ type: "SHORT_TEXT", prompt: "Name?", optionsText: "", ratingMax: "5" });
    expect(r.success).toBe(true);
  });
  it("rejects ratingMax < 2 and > 10", () => {
    expect(questionSchema.safeParse({ type: "RATING", prompt: "Q", optionsText: "", ratingMax: "1" }).success).toBe(false);
    expect(questionSchema.safeParse({ type: "RATING", prompt: "Q", optionsText: "", ratingMax: "11" }).success).toBe(false);
  });
});

describe("validateAnswer", () => {
  const text = { type: "SHORT_TEXT" as const, required: true, options: [], ratingMax: 5 };
  const optText = { type: "SHORT_TEXT" as const, required: false, options: [], ratingMax: 5 };
  const rating = { type: "RATING" as const, required: true, options: [], ratingMax: 5 };
  const single = { type: "SINGLE_CHOICE" as const, required: true, options: ["A", "B", "C"], ratingMax: 5 };
  const multi = { type: "MULTI_CHOICE" as const, required: true, options: ["A", "B", "C"], ratingMax: 5 };
  const email = { type: "EMAIL" as const, required: true, options: [], ratingMax: 5 };

  it("rejects empty required text", () => {
    const r = validateAnswer(text, { text: "" });
    expect(r.ok).toBe(false);
  });
  it("accepts empty optional text as null", () => {
    const r = validateAnswer(optText, { text: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.text).toBeNull();
  });
  it("rejects rating outside range", () => {
    expect(validateAnswer(rating, { number: "0" }).ok).toBe(false);
    expect(validateAnswer(rating, { number: "6" }).ok).toBe(false);
    expect(validateAnswer(rating, { number: "3.5" }).ok).toBe(false);
  });
  it("accepts valid rating", () => {
    const r = validateAnswer(rating, { number: "4" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.number).toBe(4);
  });
  it("rejects unknown choice", () => {
    expect(validateAnswer(single, { choices: ["X"] }).ok).toBe(false);
  });
  it("rejects multiple selections for SINGLE_CHOICE", () => {
    expect(validateAnswer(single, { choices: ["A", "B"] }).ok).toBe(false);
  });
  it("accepts valid single choice", () => {
    const r = validateAnswer(single, { choices: ["B"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.choices).toEqual(["B"]);
  });
  it("dedupes multi-choice answers", () => {
    const r = validateAnswer(multi, { choices: ["A", "A", "B"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.choices).toEqual(["A", "B"]);
  });
  it("lowercases email", () => {
    const r = validateAnswer(email, { text: "Foo@Example.COM" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.text).toBe("foo@example.com");
  });
  it("rejects bad email", () => {
    expect(validateAnswer(email, { text: "not-email" }).ok).toBe(false);
  });
});

describe("summarizeAnswers", () => {
  it("counts choice buckets", () => {
    const q = { type: "SINGLE_CHOICE" as const, options: ["A", "B"], ratingMax: 5 };
    const s = summarizeAnswers(q, [
      { text: null, number: null, choices: ["A"] },
      { text: null, number: null, choices: ["A"] },
      { text: null, number: null, choices: ["B"] },
    ]);
    expect(s.total).toBe(3);
    expect(s.buckets).toEqual([
      { label: "A", count: 2 },
      { label: "B", count: 1 },
    ]);
  });
  it("computes number stats", () => {
    const q = { type: "RATING" as const, options: [], ratingMax: 5 };
    const s = summarizeAnswers(q, [
      { text: null, number: 5, choices: [] },
      { text: null, number: 3, choices: [] },
      { text: null, number: 4, choices: [] },
    ]);
    expect(s.numbers).toBeDefined();
    expect(s.numbers!.avg).toBeCloseTo(4);
    expect(s.numbers!.min).toBe(3);
    expect(s.numbers!.max).toBe(5);
  });
  it("handles zero number answers", () => {
    const q = { type: "NUMBER" as const, options: [], ratingMax: 5 };
    const s = summarizeAnswers(q, []);
    expect(s.numbers!.count).toBe(0);
    expect(s.numbers!.avg).toBe(0);
  });
});
