import { describe, expect, it } from "vitest";
import {
  TASK_STATUSES,
  addDays,
  computeBar,
  computeRange,
  diffDays,
  ganttDependencySchema,
  ganttTaskSchema,
  startOfDay,
  summarizeGantt,
  toIsoDate,
  wouldCreateCycle,
} from "@/modules/gantt/schemas";

describe("gantt constants", () => {
  it("exposes statuses", () => {
    expect(TASK_STATUSES).toContain("TODO");
    expect(TASK_STATUSES).toContain("DONE");
  });
});

describe("date helpers", () => {
  it("startOfDay zeros the time", () => {
    const d = startOfDay("2026-04-26T18:30:00.000Z");
    expect(d.getHours()).toBe(0);
  });
  it("diffDays returns whole days between dates", () => {
    expect(diffDays("2026-01-01", "2026-01-05")).toBe(4);
    expect(diffDays("2026-01-05", "2026-01-01")).toBe(-4);
    expect(diffDays("2026-01-01", "2026-01-01")).toBe(0);
  });
  it("addDays advances dates", () => {
    const d = addDays("2026-01-01", 3);
    expect(d.getDate()).toBe(4);
  });
  it("toIsoDate produces YYYY-MM-DD", () => {
    expect(toIsoDate(new Date(2026, 3, 5))).toBe("2026-04-05");
    expect(toIsoDate(null)).toBe("");
  });
});

describe("ganttTaskSchema", () => {
  it("accepts well-formed input", () => {
    const v = ganttTaskSchema.parse({
      startAt: "2026-04-01",
      endAt: "2026-04-05",
      progress: "50",
    });
    expect(v.startAt).toBe("2026-04-01");
    expect(v.endAt).toBe("2026-04-05");
    expect(v.progress).toBe(50);
  });
  it("normalizes empty dates to undefined", () => {
    const v = ganttTaskSchema.parse({});
    expect(v.startAt).toBeUndefined();
    expect(v.endAt).toBeUndefined();
    expect(v.progress).toBe(0);
  });
  it("rejects start after end", () => {
    expect(() =>
      ganttTaskSchema.parse({ startAt: "2026-04-10", endAt: "2026-04-01" }),
    ).toThrow();
  });
  it("rejects invalid date format", () => {
    expect(() => ganttTaskSchema.parse({ startAt: "04/01/2026" })).toThrow();
  });
  it("clamps progress out of range", () => {
    expect(() => ganttTaskSchema.parse({ progress: "150" })).toThrow();
    expect(() => ganttTaskSchema.parse({ progress: "-5" })).toThrow();
  });
});

describe("ganttDependencySchema", () => {
  it("rejects self-dependency", () => {
    expect(() =>
      ganttDependencySchema.parse({ predecessorId: "t1", successorId: "t1" }),
    ).toThrow();
  });
  it("accepts distinct ids", () => {
    const v = ganttDependencySchema.parse({
      predecessorId: "a",
      successorId: "b",
    });
    expect(v.predecessorId).toBe("a");
  });
});

describe("computeRange / computeBar", () => {
  const tasks = [
    { startAt: new Date(2026, 3, 1), endAt: new Date(2026, 3, 3) },
    { startAt: new Date(2026, 3, 4), endAt: new Date(2026, 3, 6) },
  ];
  it("returns null when no scheduled tasks", () => {
    expect(computeRange([{ startAt: null, endAt: null }])).toBeNull();
  });
  it("spans min start to max end", () => {
    const r = computeRange(tasks)!;
    expect(toIsoDate(r.min)).toBe("2026-04-01");
    expect(toIsoDate(r.max)).toBe("2026-04-06");
    expect(r.days).toBe(6);
  });
  it("computes bars within range", () => {
    const r = computeRange(tasks)!;
    const bar = computeBar(tasks[1], r);
    expect(bar?.offsetDays).toBe(3);
    expect(bar?.spanDays).toBe(3);
  });
  it("returns null bar for unscheduled task", () => {
    const r = computeRange(tasks)!;
    expect(computeBar({ startAt: null, endAt: null }, r)).toBeNull();
  });
});

describe("summarizeGantt", () => {
  it("counts scheduled vs unscheduled and done", () => {
    const r = summarizeGantt([
      { status: "TODO", startAt: new Date(), endAt: new Date() },
      { status: "DONE", startAt: new Date(), endAt: new Date() },
      { status: "DONE", startAt: null, endAt: null },
    ]);
    expect(r.total).toBe(3);
    expect(r.scheduled).toBe(2);
    expect(r.unscheduled).toBe(1);
    expect(r.done).toBe(2);
  });
});

describe("wouldCreateCycle", () => {
  const edges = [
    { predecessorId: "a", successorId: "b" },
    { predecessorId: "b", successorId: "c" },
  ];
  it("rejects self loops", () => {
    expect(wouldCreateCycle([], "x", "x")).toBe(true);
  });
  it("rejects edge that closes a cycle", () => {
    // adding c → a would form a → b → c → a
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true);
  });
  it("allows safe edges", () => {
    expect(wouldCreateCycle(edges, "a", "c")).toBe(false);
    expect(wouldCreateCycle(edges, "d", "a")).toBe(false);
  });
});
