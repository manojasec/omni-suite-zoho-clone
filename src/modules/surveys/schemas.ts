import { z } from "zod";
import type { SurveyQuestionType } from "@prisma/client";

export const SURVEY_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export const QUESTION_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "RATING",
  "NUMBER",
  "EMAIL",
] as const;

export const QUESTION_TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  SINGLE_CHOICE: "Single choice",
  MULTI_CHOICE: "Multiple choice",
  RATING: "Rating",
  NUMBER: "Number",
  EMAIL: "Email",
};

export function questionUsesOptions(t: SurveyQuestionType): boolean {
  return t === "SINGLE_CHOICE" || t === "MULTI_CHOICE";
}

export function questionUsesRating(t: SurveyQuestionType): boolean {
  return t === "RATING";
}

export const surveySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(1000).optional(),
  ),
  thankYouText: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  closesAt: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional(),
  ),
});

export const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1).max(500),
    helpText: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.string().trim().max(500).optional(),
    ),
    required: z.coerce.boolean().default(false),
    optionsText: z.string().optional(),
    ratingMax: z.coerce.number().int().min(2).max(10).default(5),
  })
  .transform((v) => {
    const opts = (v.optionsText ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    return {
      type: v.type,
      prompt: v.prompt,
      helpText: v.helpText,
      required: v.required,
      options: opts,
      ratingMax: v.ratingMax,
    };
  })
  .superRefine((v, ctx) => {
    if (questionUsesOptions(v.type) && v.options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["optionsText"], message: "Provide at least 2 options (one per line)" });
    }
    if (!questionUsesOptions(v.type) && v.options.length > 0) {
      // ignore — they are simply unused
    }
  });

export const answerInputSchema = z.object({
  questionId: z.string().min(1),
  text: z.string().optional(),
  number: z.string().optional(),
  choices: z.array(z.string()).optional(),
});

export const submitResponseSchema = z.object({
  respondent: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(160).optional(),
  ),
});

export type SurveyInput = z.infer<typeof surveySchema>;
export type QuestionInput = z.infer<typeof questionSchema>;

/**
 * Validate a single answer payload against its question definition.
 * Returns either { ok: true, value } where value is { text?, number?, choices } or { ok: false, message }.
 */
export function validateAnswer(
  question: { type: SurveyQuestionType; required: boolean; options: string[]; ratingMax: number },
  raw: { text?: string; number?: string; choices?: string[] },
): { ok: true; value: { text: string | null; number: number | null; choices: string[] } } | { ok: false; message: string } {
  const text = (raw.text ?? "").trim();
  const numberStr = (raw.number ?? "").trim();
  const choices = (raw.choices ?? []).filter(Boolean);

  switch (question.type) {
    case "SHORT_TEXT":
    case "LONG_TEXT": {
      if (!text) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      const max = question.type === "SHORT_TEXT" ? 500 : 4000;
      if (text.length > max) return { ok: false, message: `Max ${max} characters` };
      return { ok: true, value: { text, number: null, choices: [] } };
    }
    case "EMAIL": {
      if (!text) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      const r = z.string().email().safeParse(text);
      if (!r.success) return { ok: false, message: "Invalid email" };
      return { ok: true, value: { text: text.toLowerCase(), number: null, choices: [] } };
    }
    case "NUMBER": {
      if (!numberStr) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      const n = Number(numberStr);
      if (!Number.isFinite(n)) return { ok: false, message: "Invalid number" };
      return { ok: true, value: { text: null, number: n, choices: [] } };
    }
    case "RATING": {
      if (!numberStr) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      const n = Number(numberStr);
      if (!Number.isInteger(n) || n < 1 || n > question.ratingMax) {
        return { ok: false, message: `Rating must be between 1 and ${question.ratingMax}` };
      }
      return { ok: true, value: { text: null, number: n, choices: [] } };
    }
    case "SINGLE_CHOICE": {
      if (choices.length === 0) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      if (choices.length > 1) return { ok: false, message: "Pick one option" };
      if (!question.options.includes(choices[0])) return { ok: false, message: "Unknown option" };
      return { ok: true, value: { text: null, number: null, choices } };
    }
    case "MULTI_CHOICE": {
      if (choices.length === 0) {
        if (question.required) return { ok: false, message: "Required" };
        return { ok: true, value: { text: null, number: null, choices: [] } };
      }
      const allowed = new Set(question.options);
      for (const c of choices) if (!allowed.has(c)) return { ok: false, message: "Unknown option" };
      return { ok: true, value: { text: null, number: null, choices: Array.from(new Set(choices)) } };
    }
  }
}

/**
 * Aggregate answers for analytics summary on a single question.
 */
export function summarizeAnswers(
  question: { type: SurveyQuestionType; options: string[]; ratingMax: number },
  answers: Array<{ text: string | null; number: number | null; choices: unknown }>,
): {
  total: number;
  buckets?: Array<{ label: string; count: number }>;
  numbers?: { count: number; sum: number; avg: number; min: number; max: number };
} {
  const total = answers.length;
  if (question.type === "SINGLE_CHOICE" || question.type === "MULTI_CHOICE") {
    const counts: Record<string, number> = {};
    for (const opt of question.options) counts[opt] = 0;
    for (const a of answers) {
      const arr = Array.isArray(a.choices) ? (a.choices as unknown[]).filter((x): x is string => typeof x === "string") : [];
      for (const c of arr) counts[c] = (counts[c] ?? 0) + 1;
    }
    return { total, buckets: Object.entries(counts).map(([label, count]) => ({ label, count })) };
  }
  if (question.type === "RATING" || question.type === "NUMBER") {
    const nums = answers.map((a) => a.number).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (nums.length === 0) return { total, numbers: { count: 0, sum: 0, avg: 0, min: 0, max: 0 } };
    const sum = nums.reduce((s, x) => s + x, 0);
    return {
      total,
      numbers: {
        count: nums.length,
        sum,
        avg: sum / nums.length,
        min: Math.min(...nums),
        max: Math.max(...nums),
      },
    };
  }
  return { total };
}
