import { describe, expect, it } from "vitest";
import {
  GOAL_STATUSES,
  KEY_RESULT_UNITS,
  formatGoalStatus,
  goalProgress,
  goalSchema,
  goalStatusColor,
  keyResultProgress,
} from "@/modules/goals/schemas";

describe("goals/schemas", () => {
  it("exposes the expected status set", () => {
    expect(GOAL_STATUSES).toEqual([
      "ON_TRACK",
      "AT_RISK",
      "OFF_TRACK",
      "COMPLETED",
      "ARCHIVED",
    ]);
  });

  it("exposes the expected key-result units", () => {
    expect(KEY_RESULT_UNITS).toContain("PERCENT");
    expect(KEY_RESULT_UNITS).toContain("BOOLEAN");
  });

  it("formats statuses to human labels", () => {
    expect(formatGoalStatus("ON_TRACK")).toMatch(/track/i);
    expect(formatGoalStatus("AT_RISK")).toMatch(/risk/i);
  });

  it("returns distinct color classes per status", () => {
    const colors = GOAL_STATUSES.map(goalStatusColor);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("computes percent/number/currency progress linearly", () => {
    expect(
      keyResultProgress({
        unit: "PERCENT",
        startValue: 0,
        targetValue: 100,
        currentValue: 25,
      }),
    ).toBe(25);
    expect(
      keyResultProgress({
        unit: "NUMBER",
        startValue: 10,
        targetValue: 20,
        currentValue: 15,
      }),
    ).toBe(50);
    expect(
      keyResultProgress({
        unit: "CURRENCY",
        startValue: 100,
        targetValue: 200,
        currentValue: 175,
      }),
    ).toBe(75);
  });

  it("treats BOOLEAN as 100% only when current >= target", () => {
    expect(
      keyResultProgress({
        unit: "BOOLEAN",
        startValue: 0,
        targetValue: 1,
        currentValue: 0,
      }),
    ).toBe(0);
    expect(
      keyResultProgress({
        unit: "BOOLEAN",
        startValue: 0,
        targetValue: 1,
        currentValue: 1,
      }),
    ).toBe(100);
  });

  it("clamps progress to [0,100]", () => {
    expect(
      keyResultProgress({
        unit: "NUMBER",
        startValue: 0,
        targetValue: 10,
        currentValue: -5,
      }),
    ).toBe(0);
    expect(
      keyResultProgress({
        unit: "NUMBER",
        startValue: 0,
        targetValue: 10,
        currentValue: 50,
      }),
    ).toBe(100);
  });

  it("treats zero span as complete only when current >= target", () => {
    expect(
      keyResultProgress({
        unit: "NUMBER",
        startValue: 5,
        targetValue: 5,
        currentValue: 5,
      }),
    ).toBe(100);
    expect(
      keyResultProgress({
        unit: "NUMBER",
        startValue: 5,
        targetValue: 5,
        currentValue: 4,
      }),
    ).toBe(0);
  });

  it("goalProgress returns 0 for empty key-results", () => {
    expect(goalProgress([])).toBe(0);
  });

  it("goalProgress averages key-result progress", () => {
    const v = goalProgress([
      {
        unit: "PERCENT",
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
      },
      {
        unit: "PERCENT",
        startValue: 0,
        targetValue: 100,
        currentValue: 100,
      },
    ]);
    expect(v).toBe(75);
  });

  it("goalSchema validates a minimum payload", () => {
    const r = goalSchema.safeParse({
      title: "Reach 100 customers",
      description: "",
      status: "ON_TRACK",
      parentId: "",
      ownerId: "",
      startDate: "",
      dueDate: "",
    });
    expect(r.success).toBe(true);
  });

  it("goalSchema rejects an empty title", () => {
    const r = goalSchema.safeParse({
      title: "",
      status: "ON_TRACK",
    });
    expect(r.success).toBe(false);
  });

  it("goalSchema enforces a 200 char limit on title", () => {
    const r = goalSchema.safeParse({
      title: "a".repeat(201),
      status: "ON_TRACK",
    });
    expect(r.success).toBe(false);
  });
});
