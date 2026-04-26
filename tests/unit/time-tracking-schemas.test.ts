import { describe, expect, it } from "vitest";
import {
  computeDurationSec,
  formatDuration,
  groupByDay,
  isoDateKey,
  manualEntrySchema,
  startTimerSchema,
  startOfDay,
  summarizeEntries,
  toDateTimeLocal,
  toHours,
} from "@/modules/time-tracking/schemas";

describe("formatDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 05s");
    expect(formatDuration(3725)).toBe("1h 02m");
  });
});

describe("computeDurationSec", () => {
  it("returns whole seconds between dates", () => {
    const a = new Date(2026, 3, 1, 9, 0, 0);
    const b = new Date(2026, 3, 1, 9, 30, 30);
    expect(computeDurationSec(a, b)).toBe(1830);
  });
  it("returns 0 when ended is null", () => {
    expect(computeDurationSec(new Date(), null)).toBe(0);
  });
  it("never returns negative", () => {
    const a = new Date(2026, 3, 1, 10, 0, 0);
    const b = new Date(2026, 3, 1, 9, 0, 0);
    expect(computeDurationSec(a, b)).toBe(0);
  });
});

describe("toHours", () => {
  it("converts seconds to hours rounded to 2 decimals", () => {
    expect(toHours(3600)).toBe(1);
    expect(toHours(5400)).toBe(1.5);
    expect(toHours(60)).toBe(0.02);
  });
});

describe("date helpers", () => {
  it("isoDateKey is YYYY-MM-DD", () => {
    expect(isoDateKey(new Date(2026, 3, 5))).toBe("2026-04-05");
  });
  it("startOfDay zeros time", () => {
    const d = startOfDay(new Date(2026, 3, 5, 18, 30));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
  it("toDateTimeLocal returns YYYY-MM-DDTHH:mm", () => {
    const s = toDateTimeLocal(new Date(2026, 3, 5, 8, 7));
    expect(s).toBe("2026-04-05T08:07");
    expect(toDateTimeLocal(null)).toBe("");
  });
});

describe("startTimerSchema", () => {
  it("normalizes empty IDs and billable checkbox", () => {
    const v = startTimerSchema.parse({
      taskId: "",
      projectId: "",
      description: "  hello  ",
      billable: "on",
    });
    expect(v.taskId).toBeUndefined();
    expect(v.projectId).toBeUndefined();
    expect(v.description).toBe("hello");
    expect(v.billable).toBe(true);
  });
  it("treats unchecked billable as false", () => {
    const v = startTimerSchema.parse({});
    expect(v.billable).toBe(false);
  });
});

describe("manualEntrySchema", () => {
  it("requires end after start", () => {
    expect(() =>
      manualEntrySchema.parse({
        startedAt: "2026-04-01T10:00",
        endedAt: "2026-04-01T09:00",
      }),
    ).toThrow();
  });
  it("rejects entries longer than 24 hours", () => {
    expect(() =>
      manualEntrySchema.parse({
        startedAt: "2026-04-01T10:00",
        endedAt: "2026-04-03T10:01",
      }),
    ).toThrow();
  });
  it("accepts a valid entry", () => {
    const v = manualEntrySchema.parse({
      startedAt: "2026-04-01T09:00",
      endedAt: "2026-04-01T10:30",
      description: "work",
      billable: "on",
    });
    expect(v.startedAt).toBeInstanceOf(Date);
    expect(v.endedAt.getTime() - v.startedAt.getTime()).toBe(90 * 60 * 1000);
    expect(v.billable).toBe(true);
  });
});

describe("summarizeEntries", () => {
  it("sums billable, total, and counts running timers", () => {
    const r = summarizeEntries([
      {
        id: "1",
        startedAt: new Date(),
        endedAt: new Date(),
        durationSec: 3600,
        billable: true,
      },
      {
        id: "2",
        startedAt: new Date(),
        endedAt: new Date(),
        durationSec: 1800,
        billable: false,
      },
      {
        id: "3",
        startedAt: new Date(),
        endedAt: null,
        durationSec: 0,
        billable: true,
      },
    ]);
    expect(r.totalSec).toBe(5400);
    expect(r.billableSec).toBe(3600);
    expect(r.nonBillableSec).toBe(1800);
    expect(r.runningCount).toBe(1);
    expect(r.count).toBe(3);
    expect(r.totalHours).toBe(1.5);
  });
});

describe("groupByDay", () => {
  it("groups entries into days sorted descending", () => {
    const day1 = new Date(2026, 3, 1, 9, 0);
    const day1Later = new Date(2026, 3, 1, 14, 0);
    const day2 = new Date(2026, 3, 2, 10, 0);
    const r = groupByDay([
      {
        id: "a",
        startedAt: day1,
        endedAt: new Date(day1.getTime() + 3600_000),
        durationSec: 3600,
        billable: true,
      },
      {
        id: "b",
        startedAt: day2,
        endedAt: new Date(day2.getTime() + 1800_000),
        durationSec: 1800,
        billable: true,
      },
      {
        id: "c",
        startedAt: day1Later,
        endedAt: new Date(day1Later.getTime() + 600_000),
        durationSec: 600,
        billable: true,
      },
    ]);
    expect(r.map((d) => d.date)).toEqual(["2026-04-02", "2026-04-01"]);
    expect(r[1].totalSec).toBe(4200);
    // within the day, later entry first
    expect(r[1].entries[0].id).toBe("c");
  });
});
