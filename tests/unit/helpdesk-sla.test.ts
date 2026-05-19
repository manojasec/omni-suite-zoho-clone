import { describe, it, expect } from "vitest";
import {
  ALWAYS_OPEN_UTC,
  addBusinessMinutes,
  calculateSlaTargets,
  checkBreach,
  DEFAULT_SLA_BY_PRIORITY,
  type BusinessCalendar,
} from "@/modules/helpdesk/sla";

const NINE_TO_FIVE_UTC: BusinessCalendar = {
  weekly: {
    0: [],
    1: [{ start: 9 * 60, end: 17 * 60 }],
    2: [{ start: 9 * 60, end: 17 * 60 }],
    3: [{ start: 9 * 60, end: 17 * 60 }],
    4: [{ start: 9 * 60, end: 17 * 60 }],
    5: [{ start: 9 * 60, end: 17 * 60 }],
    6: [],
  },
  holidays: [],
  timezoneOffsetMinutes: 0,
};

describe("addBusinessMinutes — 24/7", () => {
  it("returns start when minutes <= 0", () => {
    const start = new Date("2025-06-02T10:00:00Z");
    expect(addBusinessMinutes(start, 0, ALWAYS_OPEN_UTC)).toEqual(start);
  });

  it("adds plain wall-clock minutes when 24/7", () => {
    const start = new Date("2025-06-02T10:00:00Z");
    const due = addBusinessMinutes(start, 90, ALWAYS_OPEN_UTC);
    expect(due.toISOString()).toBe("2025-06-02T11:30:00.000Z");
  });
});

describe("addBusinessMinutes — 9-to-5 weekdays", () => {
  it("stays inside the same day when capacity allows", () => {
    const start = new Date("2025-06-02T10:00:00Z"); // Mon 10:00
    const due = addBusinessMinutes(start, 60, NINE_TO_FIVE_UTC);
    expect(due.toISOString()).toBe("2025-06-02T11:00:00.000Z");
  });

  it("advances to next morning when day's window is exhausted", () => {
    const start = new Date("2025-06-02T16:00:00Z"); // Mon 16:00
    // 60 min today (16-17) + 60 min spillover → Tue 10:00
    const due = addBusinessMinutes(start, 120, NINE_TO_FIVE_UTC);
    expect(due.toISOString()).toBe("2025-06-03T10:00:00.000Z");
  });

  it("skips Saturday & Sunday", () => {
    const start = new Date("2025-06-06T16:00:00Z"); // Fri 16:00
    // 60 min Fri → 17:00, weekend skipped, 60 min Mon → 10:00
    const due = addBusinessMinutes(start, 120, NINE_TO_FIVE_UTC);
    expect(due.toISOString()).toBe("2025-06-09T10:00:00.000Z");
  });

  it("treats holidays as fully closed", () => {
    const calWithHoliday: BusinessCalendar = {
      ...NINE_TO_FIVE_UTC,
      holidays: ["2025-06-03"],
    };
    const start = new Date("2025-06-02T16:00:00Z");
    // Mon 16-17 (60), Tue holiday → spill to Wed 09-10 (60)
    const due = addBusinessMinutes(start, 120, calWithHoliday);
    expect(due.toISOString()).toBe("2025-06-04T10:00:00.000Z");
  });

  it("starts at window open when arrival is before hours", () => {
    const start = new Date("2025-06-02T07:00:00Z"); // Mon 07:00
    const due = addBusinessMinutes(start, 30, NINE_TO_FIVE_UTC);
    expect(due.toISOString()).toBe("2025-06-02T09:30:00.000Z");
  });
});

describe("calculateSlaTargets", () => {
  it("computes both deadlines from the policy", () => {
    const targets = calculateSlaTargets({
      createdAt: new Date("2025-06-02T10:00:00Z"),
      policy: { firstResponseMinutes: 30, resolveMinutes: 240 },
      calendar: NINE_TO_FIVE_UTC,
    });
    expect(targets.firstResponseDueAt.toISOString()).toBe("2025-06-02T10:30:00.000Z");
    expect(targets.resolveDueAt.toISOString()).toBe("2025-06-02T14:00:00.000Z");
  });

  it("defaults to 24/7 calendar when none given", () => {
    const targets = calculateSlaTargets({
      createdAt: new Date("2025-06-02T10:00:00Z"),
      policy: DEFAULT_SLA_BY_PRIORITY.URGENT,
    });
    expect(targets.firstResponseDueAt.toISOString()).toBe("2025-06-02T10:15:00.000Z");
  });
});

describe("checkBreach", () => {
  it("flags breached when now is past target", () => {
    const r = checkBreach({
      target: new Date("2025-06-02T10:00:00Z"),
      now: new Date("2025-06-02T11:00:00Z"),
    });
    expect(r.breached).toBe(true);
    expect(r.remainingMs).toBeLessThan(0);
  });

  it("flags warning when within threshold", () => {
    const r = checkBreach({
      target: new Date("2025-06-02T10:30:00Z"),
      now: new Date("2025-06-02T10:15:00Z"),
      warnThresholdMs: 30 * 60_000,
    });
    expect(r.breached).toBe(false);
    expect(r.warning).toBe(true);
  });

  it("subtracts paused time from remaining", () => {
    // Target was 10:00, now is 10:30, but 60min paused → remaining = +30min.
    const r = checkBreach({
      target: new Date("2025-06-02T10:00:00Z"),
      now: new Date("2025-06-02T10:30:00Z"),
      pausedMs: 60 * 60_000,
    });
    expect(r.breached).toBe(false);
    expect(r.remainingMs).toBe(30 * 60_000);
  });
});
