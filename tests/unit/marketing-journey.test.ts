import { describe, it, expect } from "vitest";
import {
  advance,
  enroll,
  evaluateCondition,
  type JourneyContext,
  type JourneyStep,
} from "@/modules/marketing/journey";

const baseCtx: JourneyContext = { tags: [], recentEvents: {}, score: 0 };

const linearJourney: JourneyStep[] = [
  { id: "s0", type: "START", nextStepId: "s1" },
  { id: "s1", type: "SEND_EMAIL", templateId: "welcome", nextStepId: "s2" },
  { id: "s2", type: "WAIT", delayMs: 60_000, nextStepId: "s3" },
  { id: "s3", type: "SEND_EMAIL", templateId: "nurture", nextStepId: null },
];

describe("journey — enroll + linear flow", () => {
  it("starts the enrollment at the START step", () => {
    const e = enroll(linearJourney, "c1");
    expect(e.currentStepId).toBe("s0");
    expect(e.exited).toBe(false);
  });

  it("returns 'send' through START → SEND_EMAIL", () => {
    const e = enroll(linearJourney, "c1");
    const r = advance(linearJourney, e, baseCtx);
    expect(r.kind).toBe("send");
    if (r.kind === "send") {
      expect(r.templateId).toBe("welcome");
      expect(r.nextEnrollment.currentStepId).toBe("s2");
    }
  });

  it("WAIT produces a wait action with resumeAt in the future", () => {
    const e = enroll(linearJourney, "c1");
    const after = advance(linearJourney, e, baseCtx).nextEnrollment;
    const now = new Date("2026-05-09T10:00:00Z");
    const r = advance(linearJourney, after, baseCtx, now);
    expect(r.kind).toBe("wait");
    if (r.kind === "wait") {
      expect(r.resumeAt.getTime()).toBe(now.getTime() + 60_000);
    }
  });

  it("noop while inside a wait window", () => {
    const e = enroll(linearJourney, "c1");
    const afterSend = advance(linearJourney, e, baseCtx).nextEnrollment;
    const now = new Date("2026-05-09T10:00:00Z");
    const afterWait = advance(linearJourney, afterSend, baseCtx, now).nextEnrollment;
    const r = advance(linearJourney, afterWait, baseCtx, new Date(now.getTime() + 5000));
    expect(r.kind).toBe("noop");
  });

  it("exits when the final SEND_EMAIL has no nextStepId", () => {
    const e = enroll(linearJourney, "c1");
    const afterSend = advance(linearJourney, e, baseCtx).nextEnrollment;
    const now = new Date("2026-05-09T10:00:00Z");
    const afterWait = advance(linearJourney, afterSend, baseCtx, now).nextEnrollment;
    const final = advance(linearJourney, afterWait, baseCtx, new Date(now.getTime() + 70_000));
    expect(final.kind).toBe("send");
    if (final.kind === "send") {
      expect(final.nextEnrollment.exited).toBe(true);
      expect(final.nextEnrollment.exitReason).toBe("end-of-journey");
    }
  });
});

describe("journey — conditions + branching", () => {
  const branchJourney: JourneyStep[] = [
    { id: "s0", type: "START", nextStepId: "b1" },
    {
      id: "b1",
      type: "BRANCH",
      condition: { kind: "hasTag", tag: "vip" },
      thenStepId: "vip",
      elseStepId: "std",
    },
    { id: "vip", type: "SEND_EMAIL", templateId: "vip", nextStepId: null },
    { id: "std", type: "SEND_EMAIL", templateId: "std", nextStepId: null },
  ];

  it("BRANCH then-branch when tag matches", () => {
    const e = enroll(branchJourney, "c1");
    const r = advance(branchJourney, e, { ...baseCtx, tags: ["vip"] });
    expect(r.kind).toBe("send");
    if (r.kind === "send") expect(r.templateId).toBe("vip");
  });

  it("BRANCH else-branch when tag missing", () => {
    const e = enroll(branchJourney, "c1");
    const r = advance(branchJourney, e, baseCtx);
    if (r.kind === "send") expect(r.templateId).toBe("std");
  });

  it("evaluateCondition hasEvent uses sinceMs window", () => {
    const now = new Date("2026-05-09T10:00:00Z");
    const recent = new Date(now.getTime() - 30 * 1000);
    expect(
      evaluateCondition(
        { kind: "hasEvent", event: "EMAIL_OPENED", sinceMs: 60_000 },
        { ...baseCtx, recentEvents: { EMAIL_OPENED: recent } },
        now,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { kind: "hasEvent", event: "EMAIL_OPENED", sinceMs: 10_000 },
        { ...baseCtx, recentEvents: { EMAIL_OPENED: recent } },
        now,
      ),
    ).toBe(false);
  });

  it("evaluateCondition scoreGte", () => {
    expect(evaluateCondition({ kind: "scoreGte", threshold: 50 }, { ...baseCtx, score: 60 }, new Date())).toBe(true);
    expect(evaluateCondition({ kind: "scoreGte", threshold: 50 }, { ...baseCtx, score: 40 }, new Date())).toBe(false);
  });
});

describe("journey — guards", () => {
  it("exits cleanly when currentStepId is missing", () => {
    const e = enroll(linearJourney, "c1");
    const broken = { ...e, currentStepId: "missing" };
    const r = advance(linearJourney, broken, baseCtx);
    expect(r.kind).toBe("exit");
    if (r.kind === "exit") expect(r.reason).toBe("missing-step");
  });

  it("detects loops via history threshold", () => {
    const loopJ: JourneyStep[] = [
      { id: "s0", type: "START", nextStepId: "b" },
      {
        id: "b",
        type: "BRANCH",
        condition: { kind: "hasTag", tag: "never" },
        thenStepId: "s0",
        elseStepId: "s0",
      },
    ];
    const r = advance(loopJ, enroll(loopJ, "c1"), baseCtx);
    expect(r.kind).toBe("exit");
    if (r.kind === "exit") expect(r.reason).toBe("loop-detected");
  });

  it("enroll throws when no START step", () => {
    expect(() => enroll([{ id: "x", type: "EXIT" }], "c1")).toThrow(/START/);
  });

  it("EXIT step terminates with the provided reason", () => {
    const j: JourneyStep[] = [
      { id: "s0", type: "START", nextStepId: "e" },
      { id: "e", type: "EXIT", reason: "goal-reached" },
    ];
    const r = advance(j, enroll(j, "c1"), baseCtx);
    expect(r.kind).toBe("exit");
    if (r.kind === "exit") expect(r.reason).toBe("goal-reached");
  });
});
