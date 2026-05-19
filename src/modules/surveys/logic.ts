/**
 * Pure survey logic engine.
 *
 * Adds two things on top of the existing schema-only surface:
 *   1. `nextQuestion()` — given current answers + ordered questions + a rule
 *      set, returns the next question or null (end-of-survey). Supports skip
 *      logic, branching by single/multi choice, and rating thresholds.
 *   2. Analytics aggregation: counts, averages, rating histograms, and
 *      completion rate.
 *
 * Rules format is intentionally simple JSON so it can be stored on the
 * existing `SurveyQuestion.options` Json field if needed without a migration.
 */

export type AnswerValue =
  | { kind: "TEXT"; text: string }
  | { kind: "NUMBER"; number: number }
  | { kind: "RATING"; number: number }
  | { kind: "EMAIL"; text: string }
  | { kind: "SINGLE_CHOICE"; choice: string }
  | { kind: "MULTI_CHOICE"; choices: string[] };

export type SurveyQuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "RATING"
  | "NUMBER"
  | "EMAIL";

export interface SurveyQuestionLite {
  id: string;
  position: number;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  options: string[];
  ratingMax: number;
}

/**
 * Skip rule. When the answer to `questionId` matches `when`, the engine jumps
 * to either `goto` (another question id) or "END" to finish the survey.
 */
export interface SkipRule {
  questionId: string;
  when:
    | { equals: string }
    | { includes: string }
    | { gte: number }
    | { lte: number };
  goto: string | "END";
}

export type AnswerMap = Record<string, AnswerValue | undefined>;

// ---------- Answer matching ----------

function matchesRule(rule: SkipRule, answer: AnswerValue | undefined): boolean {
  if (!answer) return false;
  const w = rule.when;
  if ("equals" in w) {
    if (answer.kind === "SINGLE_CHOICE") return answer.choice === w.equals;
    if (answer.kind === "TEXT" || answer.kind === "EMAIL") return answer.text === w.equals;
    return false;
  }
  if ("includes" in w) {
    if (answer.kind === "MULTI_CHOICE") return answer.choices.includes(w.includes);
    if (answer.kind === "SINGLE_CHOICE") return answer.choice === w.includes;
    return false;
  }
  if ("gte" in w) {
    if (answer.kind === "NUMBER" || answer.kind === "RATING") return answer.number >= w.gte;
    return false;
  }
  if ("lte" in w) {
    if (answer.kind === "NUMBER" || answer.kind === "RATING") return answer.number <= w.lte;
    return false;
  }
  return false;
}

/**
 * Determine the next question to display. Returns `null` when the survey ends.
 * Throws when `currentId` is missing from `questions`.
 *
 * Algorithm:
 *  1. If a skip rule for `currentId` matches, jump to its target (or END).
 *  2. Otherwise, advance to the next question by `position`.
 */
export function nextQuestion(
  questions: SurveyQuestionLite[],
  currentId: string | null,
  answers: AnswerMap,
  rules: SkipRule[] = [],
): SurveyQuestionLite | null {
  const ordered = [...questions].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;
  if (currentId === null) return ordered[0]!;

  const cur = ordered.find((q) => q.id === currentId);
  if (!cur) throw new Error(`Question ${currentId} not in survey`);

  // Apply rules anchored on the current question.
  for (const rule of rules.filter((r) => r.questionId === currentId)) {
    if (matchesRule(rule, answers[currentId])) {
      if (rule.goto === "END") return null;
      const target = ordered.find((q) => q.id === rule.goto);
      if (!target) throw new Error(`Rule target ${rule.goto} not in survey`);
      return target;
    }
  }

  // No rule fired — fall through to the next question by order.
  const idx = ordered.findIndex((q) => q.id === currentId);
  return ordered[idx + 1] ?? null;
}

/**
 * Validate that an answer satisfies a question's constraints. Returns an array
 * of error strings (empty array = valid). Used by the public submit flow before
 * persisting.
 */
export function validateAnswer(q: SurveyQuestionLite, ans: AnswerValue | undefined): string[] {
  const errs: string[] = [];
  if (!ans || isAnswerEmpty(ans)) {
    if (q.required) errs.push("Answer is required");
    return errs;
  }
  switch (q.type) {
    case "EMAIL":
      if (ans.kind !== "EMAIL" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ans.text)) errs.push("Invalid email");
      break;
    case "RATING":
      if (ans.kind !== "RATING" || ans.number < 1 || ans.number > q.ratingMax) errs.push(`Rating must be 1..${q.ratingMax}`);
      break;
    case "SINGLE_CHOICE":
      if (ans.kind !== "SINGLE_CHOICE" || !q.options.includes(ans.choice)) errs.push("Choice not in options");
      break;
    case "MULTI_CHOICE":
      if (ans.kind !== "MULTI_CHOICE") errs.push("Expected multi-choice answer");
      else if (ans.choices.some((c) => !q.options.includes(c))) errs.push("Choice not in options");
      break;
    case "NUMBER":
      if (ans.kind !== "NUMBER" || !Number.isFinite(ans.number)) errs.push("Invalid number");
      break;
    case "SHORT_TEXT":
    case "LONG_TEXT":
      if (ans.kind !== "TEXT") errs.push("Expected text answer");
      break;
  }
  return errs;
}

function isAnswerEmpty(ans: AnswerValue): boolean {
  switch (ans.kind) {
    case "TEXT":
    case "EMAIL":
      return ans.text.trim().length === 0;
    case "NUMBER":
    case "RATING":
      return !Number.isFinite(ans.number);
    case "SINGLE_CHOICE":
      return ans.choice.length === 0;
    case "MULTI_CHOICE":
      return ans.choices.length === 0;
  }
}

// ---------- Analytics ----------

export interface QuestionStats {
  questionId: string;
  type: SurveyQuestionType;
  responseCount: number;
  /** Choice counts for SINGLE_CHOICE / MULTI_CHOICE. */
  choiceCounts?: Record<string, number>;
  /** Numeric mean for NUMBER and RATING. */
  mean?: number;
  /** 1..ratingMax histogram for RATING. */
  ratingHistogram?: number[];
}

export interface SurveyAnalytics {
  totalResponses: number;
  questions: QuestionStats[];
}

export function aggregateSurvey(
  questions: SurveyQuestionLite[],
  responses: AnswerMap[],
): SurveyAnalytics {
  const stats: QuestionStats[] = questions.map((q) => {
    const base: QuestionStats = { questionId: q.id, type: q.type, responseCount: 0 };
    if (q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") {
      base.choiceCounts = Object.fromEntries(q.options.map((o) => [o, 0]));
    }
    if (q.type === "RATING") {
      base.ratingHistogram = new Array(q.ratingMax).fill(0);
    }
    return base;
  });

  let sumByQ: Record<string, number> = {};
  let countByQ: Record<string, number> = {};

  for (const resp of responses) {
    for (const stat of stats) {
      const ans = resp[stat.questionId];
      if (!ans || isAnswerEmpty(ans)) continue;
      stat.responseCount += 1;
      if (ans.kind === "SINGLE_CHOICE" && stat.choiceCounts) {
        stat.choiceCounts[ans.choice] = (stat.choiceCounts[ans.choice] ?? 0) + 1;
      } else if (ans.kind === "MULTI_CHOICE" && stat.choiceCounts) {
        for (const c of ans.choices) {
          stat.choiceCounts[c] = (stat.choiceCounts[c] ?? 0) + 1;
        }
      } else if (ans.kind === "NUMBER" || ans.kind === "RATING") {
        sumByQ[stat.questionId] = (sumByQ[stat.questionId] ?? 0) + ans.number;
        countByQ[stat.questionId] = (countByQ[stat.questionId] ?? 0) + 1;
        if (ans.kind === "RATING" && stat.ratingHistogram) {
          const bin = Math.max(1, Math.min(stat.ratingHistogram.length, Math.round(ans.number))) - 1;
          stat.ratingHistogram[bin] += 1;
        }
      }
    }
  }

  for (const stat of stats) {
    const c = countByQ[stat.questionId];
    if (c && c > 0) stat.mean = (sumByQ[stat.questionId] ?? 0) / c;
  }

  return { totalResponses: responses.length, questions: stats };
}

/**
 * Completion rate = fully-answered (every required question answered) responses
 * divided by total responses.
 */
export function completionRate(
  questions: SurveyQuestionLite[],
  responses: AnswerMap[],
): number {
  if (responses.length === 0) return 0;
  const required = questions.filter((q) => q.required);
  const complete = responses.filter((r) =>
    required.every((q) => {
      const a = r[q.id];
      return a !== undefined && !isAnswerEmpty(a);
    }),
  );
  return complete.length / responses.length;
}
