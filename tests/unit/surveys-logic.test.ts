import { describe, it, expect } from "vitest";
import {
  aggregateSurvey,
  completionRate,
  nextQuestion,
  validateAnswer,
  type AnswerMap,
  type SkipRule,
  type SurveyQuestionLite,
} from "@/modules/surveys/logic";

const Qs: SurveyQuestionLite[] = [
  { id: "q1", position: 1, type: "SINGLE_CHOICE", prompt: "Use product?", required: true, options: ["yes", "no"], ratingMax: 5 },
  { id: "q2", position: 2, type: "RATING", prompt: "Satisfaction?", required: true, options: [], ratingMax: 5 },
  { id: "q3", position: 3, type: "LONG_TEXT", prompt: "Why not?", required: false, options: [], ratingMax: 5 },
  { id: "q4", position: 4, type: "EMAIL", prompt: "Email?", required: false, options: [], ratingMax: 5 },
];

describe("survey logic — nextQuestion ordering", () => {
  it("returns the first question when current is null", () => {
    expect(nextQuestion(Qs, null, {})?.id).toBe("q1");
  });

  it("falls through to next position when no rule fires", () => {
    expect(nextQuestion(Qs, "q1", { q1: { kind: "SINGLE_CHOICE", choice: "yes" } })?.id).toBe("q2");
  });

  it("returns null at end of survey", () => {
    expect(nextQuestion(Qs, "q4", {})).toBeNull();
  });

  it("throws when current id is unknown", () => {
    expect(() => nextQuestion(Qs, "missing", {})).toThrow();
  });
});

describe("survey logic — skip rules", () => {
  it("equals rule jumps to target", () => {
    const rules: SkipRule[] = [{ questionId: "q1", when: { equals: "no" }, goto: "q3" }];
    const ans: AnswerMap = { q1: { kind: "SINGLE_CHOICE", choice: "no" } };
    expect(nextQuestion(Qs, "q1", ans, rules)?.id).toBe("q3");
  });

  it("equals rule that does not match falls through", () => {
    const rules: SkipRule[] = [{ questionId: "q1", when: { equals: "no" }, goto: "q3" }];
    const ans: AnswerMap = { q1: { kind: "SINGLE_CHOICE", choice: "yes" } };
    expect(nextQuestion(Qs, "q1", ans, rules)?.id).toBe("q2");
  });

  it("includes rule matches multi-choice answers", () => {
    const Q = [...Qs, { id: "q5", position: 5, type: "MULTI_CHOICE" as const, prompt: "x", required: false, options: ["a", "b"], ratingMax: 5 }];
    const rules: SkipRule[] = [{ questionId: "q5", when: { includes: "a" }, goto: "END" }];
    const ans: AnswerMap = { q5: { kind: "MULTI_CHOICE", choices: ["a", "b"] } };
    expect(nextQuestion(Q, "q5", ans, rules)).toBeNull();
  });

  it("gte rule jumps when rating is high", () => {
    const rules: SkipRule[] = [{ questionId: "q2", when: { gte: 4 }, goto: "END" }];
    expect(nextQuestion(Qs, "q2", { q2: { kind: "RATING", number: 5 } }, rules)).toBeNull();
    expect(nextQuestion(Qs, "q2", { q2: { kind: "RATING", number: 3 } }, rules)?.id).toBe("q3");
  });

  it("throws when rule target is missing", () => {
    const rules: SkipRule[] = [{ questionId: "q1", when: { equals: "no" }, goto: "missing" }];
    expect(() => nextQuestion(Qs, "q1", { q1: { kind: "SINGLE_CHOICE", choice: "no" } }, rules)).toThrow();
  });
});

describe("survey logic — validateAnswer", () => {
  const single = Qs[0]!;
  const rating = Qs[1]!;
  const email = Qs[3]!;

  it("flags missing required answer", () => {
    expect(validateAnswer(single, undefined)).toContain("Answer is required");
  });

  it("rejects choice not in options", () => {
    expect(validateAnswer(single, { kind: "SINGLE_CHOICE", choice: "maybe" })).toContain("Choice not in options");
  });

  it("rejects out-of-range rating", () => {
    expect(validateAnswer(rating, { kind: "RATING", number: 9 })).toContain("Rating must be 1..5");
  });

  it("rejects malformed email", () => {
    expect(validateAnswer(email, { kind: "EMAIL", text: "no-at" })).toContain("Invalid email");
  });

  it("accepts valid email", () => {
    expect(validateAnswer(email, { kind: "EMAIL", text: "a@b.co" })).toEqual([]);
  });
});

describe("survey logic — aggregateSurvey + completionRate", () => {
  const responses: AnswerMap[] = [
    {
      q1: { kind: "SINGLE_CHOICE", choice: "yes" },
      q2: { kind: "RATING", number: 5 },
      q4: { kind: "EMAIL", text: "a@b.co" },
    },
    {
      q1: { kind: "SINGLE_CHOICE", choice: "no" },
      q2: { kind: "RATING", number: 2 },
    },
    {
      q1: { kind: "SINGLE_CHOICE", choice: "yes" },
      q2: { kind: "RATING", number: 4 },
    },
  ];

  it("counts choices and computes mean rating", () => {
    const stats = aggregateSurvey(Qs, responses);
    expect(stats.totalResponses).toBe(3);
    const q1 = stats.questions.find((q) => q.questionId === "q1");
    expect(q1?.choiceCounts).toEqual({ yes: 2, no: 1 });
    const q2 = stats.questions.find((q) => q.questionId === "q2");
    expect(q2?.mean).toBeCloseTo((5 + 2 + 4) / 3, 5);
    expect(q2?.ratingHistogram).toEqual([0, 1, 0, 1, 1]);
  });

  it("completionRate is 1.0 when all required answered", () => {
    expect(completionRate(Qs, responses)).toBeCloseTo(1, 5);
  });

  it("completionRate drops when required answers missing", () => {
    const partial: AnswerMap[] = [
      ...responses,
      { q1: { kind: "SINGLE_CHOICE", choice: "yes" } }, // missing required q2
    ];
    expect(completionRate(Qs, partial)).toBeCloseTo(3 / 4, 5);
  });
});
