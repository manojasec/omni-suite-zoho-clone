/**
 * Email journey runner — pure engine.
 *
 * A journey is a DAG of typed steps that drive a contact (enrollment) toward
 * one or more outcomes. Each tick the runner decides what the orchestrator
 * should do next:
 *
 *   - `send`  : ship an email and advance to `nextStepId`
 *   - `wait`  : park the enrollment until `resumeAt`
 *   - `exit`  : finalize the enrollment (goal reached or fall-through)
 *   - `noop`  : nothing to do right now (still inside a `wait`)
 *
 * No DB coupling. The orchestrator passes a `JourneyContext` describing the
 * contact's facts (tags, recent events) and the runner returns the action +
 * the new enrollment state. This makes it trivially testable.
 */

export type JourneyStep =
  | { id: string; type: "START"; nextStepId: string | null }
  | { id: string; type: "SEND_EMAIL"; templateId: string; nextStepId: string | null }
  | { id: string; type: "WAIT"; delayMs: number; nextStepId: string | null }
  | {
      id: string;
      type: "BRANCH";
      condition: JourneyCondition;
      thenStepId: string | null;
      elseStepId: string | null;
    }
  | { id: string; type: "EXIT"; reason?: string };

export type JourneyCondition =
  | { kind: "hasTag"; tag: string }
  | { kind: "hasEvent"; event: "EMAIL_OPENED" | "EMAIL_CLICKED" | "FORM_SUBMITTED"; sinceMs: number }
  | { kind: "scoreGte"; threshold: number };

export interface JourneyContext {
  /** Tags currently on the contact. */
  tags: string[];
  /** Recent activity events keyed by type → most-recent createdAt. */
  recentEvents: Partial<Record<"EMAIL_OPENED" | "EMAIL_CLICKED" | "FORM_SUBMITTED", Date>>;
  /** Current lead score. */
  score: number;
}

export interface JourneyEnrollment {
  contactId: string;
  currentStepId: string;
  waitUntil?: Date | null;
  exited: boolean;
  exitReason?: string | null;
  /** Sequence of step ids visited (newest last) — useful for analytics and
   * preventing infinite loops on malformed journeys. */
  history: string[];
}

export type JourneyAction =
  | { kind: "send"; templateId: string; nextEnrollment: JourneyEnrollment }
  | { kind: "wait"; resumeAt: Date; nextEnrollment: JourneyEnrollment }
  | { kind: "exit"; reason: string | null; nextEnrollment: JourneyEnrollment }
  | { kind: "noop"; nextEnrollment: JourneyEnrollment };

const MAX_STEPS_PER_TICK = 50;

function findStep(steps: JourneyStep[], id: string | null): JourneyStep | null {
  if (!id) return null;
  return steps.find((s) => s.id === id) ?? null;
}

export function evaluateCondition(cond: JourneyCondition, ctx: JourneyContext, now: Date): boolean {
  switch (cond.kind) {
    case "hasTag":
      return ctx.tags.includes(cond.tag);
    case "hasEvent": {
      const at = ctx.recentEvents[cond.event];
      if (!at) return false;
      return now.getTime() - at.getTime() <= cond.sinceMs;
    }
    case "scoreGte":
      return ctx.score >= cond.threshold;
  }
}

/**
 * Drive the enrollment forward starting at `currentStepId`. Returns a single
 * orchestrator-visible action (`send` / `wait` / `exit` / `noop`).
 *
 * Internal BRANCH/START steps are resolved transparently within one call —
 * the runner walks them up to `MAX_STEPS_PER_TICK` to detect loops.
 */
export function advance(
  steps: JourneyStep[],
  enrollment: JourneyEnrollment,
  ctx: JourneyContext,
  now: Date = new Date(),
): JourneyAction {
  if (enrollment.exited) {
    return { kind: "noop", nextEnrollment: enrollment };
  }
  if (enrollment.waitUntil && enrollment.waitUntil.getTime() > now.getTime()) {
    return { kind: "noop", nextEnrollment: enrollment };
  }

  let state: JourneyEnrollment = { ...enrollment, history: [...enrollment.history] };

  for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
    const step = findStep(steps, state.currentStepId);
    if (!step) {
      const exited: JourneyEnrollment = {
        ...state,
        exited: true,
        exitReason: "missing-step",
      };
      return { kind: "exit", reason: "missing-step", nextEnrollment: exited };
    }

    // Cycle guard: any step appearing >5x in history is a loop.
    const seen = state.history.filter((id) => id === step.id).length;
    if (seen >= 5) {
      const exited: JourneyEnrollment = { ...state, exited: true, exitReason: "loop-detected" };
      return { kind: "exit", reason: "loop-detected", nextEnrollment: exited };
    }
    state = { ...state, history: [...state.history, step.id] };

    switch (step.type) {
      case "START":
        if (!step.nextStepId) {
          const exited: JourneyEnrollment = { ...state, exited: true, exitReason: "no-next" };
          return { kind: "exit", reason: "no-next", nextEnrollment: exited };
        }
        state = { ...state, currentStepId: step.nextStepId, waitUntil: null };
        continue;

      case "BRANCH": {
        const hit = evaluateCondition(step.condition, ctx, now);
        const target = hit ? step.thenStepId : step.elseStepId;
        if (!target) {
          const exited: JourneyEnrollment = { ...state, exited: true, exitReason: "branch-end" };
          return { kind: "exit", reason: "branch-end", nextEnrollment: exited };
        }
        state = { ...state, currentStepId: target, waitUntil: null };
        continue;
      }

      case "WAIT": {
        const resumeAt = new Date(now.getTime() + step.delayMs);
        const next: JourneyEnrollment = {
          ...state,
          currentStepId: step.nextStepId ?? step.id,
          waitUntil: resumeAt,
        };
        // If WAIT has no nextStepId, the enrollment exits *after* the wait;
        // for simplicity we exit immediately when next is missing.
        if (!step.nextStepId) {
          const exited: JourneyEnrollment = { ...next, exited: true, exitReason: "wait-end" };
          return { kind: "exit", reason: "wait-end", nextEnrollment: exited };
        }
        return { kind: "wait", resumeAt, nextEnrollment: next };
      }

      case "SEND_EMAIL": {
        const next: JourneyEnrollment = {
          ...state,
          currentStepId: step.nextStepId ?? step.id,
          waitUntil: null,
          exited: !step.nextStepId,
          exitReason: step.nextStepId ? state.exitReason ?? null : "end-of-journey",
        };
        return { kind: "send", templateId: step.templateId, nextEnrollment: next };
      }

      case "EXIT": {
        const exited: JourneyEnrollment = {
          ...state,
          exited: true,
          exitReason: step.reason ?? null,
        };
        return { kind: "exit", reason: step.reason ?? null, nextEnrollment: exited };
      }
    }
  }

  const exited: JourneyEnrollment = { ...state, exited: true, exitReason: "step-budget" };
  return { kind: "exit", reason: "step-budget", nextEnrollment: exited };
}

/** Create a fresh enrollment seeded at the journey's START step. */
export function enroll(steps: JourneyStep[], contactId: string): JourneyEnrollment {
  const start = steps.find((s) => s.type === "START");
  if (!start) throw new Error("Journey has no START step");
  return {
    contactId,
    currentStepId: start.id,
    waitUntil: null,
    exited: false,
    exitReason: null,
    history: [],
  };
}
