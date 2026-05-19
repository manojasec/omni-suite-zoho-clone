/**
 * SLA calculator — business-hours-aware deadlines + breach detection.
 *
 * Pure engine, no DB coupling. Consumed by helpdesk tickets, ITSM incidents,
 * and any other workflow that needs a "first response by" / "resolve by"
 * deadline computed from a calendar.
 *
 * Design:
 *   - A `BusinessCalendar` declares working hours per weekday in the
 *     `timezoneOffsetMinutes`'s wall-clock, plus a list of all-day holidays.
 *   - `addBusinessMinutes(start, mins, cal)` walks forward minute-aware.
 *   - `calculateSlaTargets(input)` returns `{firstResponseDueAt, resolveDueAt}`.
 *   - `checkBreach(target, now, pausedMs?)` returns the breach state.
 *
 * Notes:
 *   - 24/7 calendars work by setting every weekday to `[{ start: 0, end: 1440 }]`.
 *   - "Paused minutes" (e.g. waiting on customer) are subtracted by passing
 *     `pausedMs` to `checkBreach`; the engine doesn't track pause state.
 */

export type BusinessHours = {
  /** Minutes from local midnight (inclusive). */
  start: number;
  /** Minutes from local midnight (exclusive). 1440 = end of day. */
  end: number;
};

export type BusinessCalendar = {
  /** 0=Sun … 6=Sat → list of working windows. Empty array = closed. */
  weekly: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, BusinessHours[]>;
  /** Holidays as ISO YYYY-MM-DD in local time; treated as fully closed. */
  holidays: string[];
  /** Local timezone offset in minutes east of UTC (e.g. India = 330, EST = -300). */
  timezoneOffsetMinutes: number;
};

export type SlaPolicy = {
  /** Minutes within which the first response must occur (business hours). */
  firstResponseMinutes: number;
  /** Minutes within which the request must be resolved (business hours). */
  resolveMinutes: number;
};

export type SlaTargets = {
  firstResponseDueAt: Date;
  resolveDueAt: Date;
};

export type BreachState = {
  /** Computed remaining ms (after subtracting paused). Negative when breached. */
  remainingMs: number;
  /** True when remainingMs <= 0. */
  breached: boolean;
  /** True when remainingMs > 0 but within `warnThresholdMs`. */
  warning: boolean;
};

/** Convenience constant for a 24/7 calendar (UTC). */
export const ALWAYS_OPEN_UTC: BusinessCalendar = {
  weekly: {
    0: [{ start: 0, end: 1440 }],
    1: [{ start: 0, end: 1440 }],
    2: [{ start: 0, end: 1440 }],
    3: [{ start: 0, end: 1440 }],
    4: [{ start: 0, end: 1440 }],
    5: [{ start: 0, end: 1440 }],
    6: [{ start: 0, end: 1440 }],
  },
  holidays: [],
  timezoneOffsetMinutes: 0,
};

/** Convert a UTC `Date` to its local-wall-clock components. */
function localOf(d: Date, tzMin: number): { dow: number; minOfDay: number; iso: string } {
  const local = new Date(d.getTime() + tzMin * 60_000);
  const dow = local.getUTCDay();
  const minOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
  const iso = local.toISOString().slice(0, 10);
  return { dow, minOfDay, iso };
}

function isHoliday(cal: BusinessCalendar, iso: string): boolean {
  return cal.holidays.includes(iso);
}

function windowsFor(cal: BusinessCalendar, dow: number, iso: string): BusinessHours[] {
  if (isHoliday(cal, iso)) return [];
  return cal.weekly[dow as 0 | 1 | 2 | 3 | 4 | 5 | 6] ?? [];
}

/**
 * Add `minutes` of business time to `start`, returning a new UTC Date.
 *
 * Walks day-by-day, consuming time inside each working window. O(days_in_span).
 */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: BusinessCalendar,
): Date {
  if (minutes <= 0) return new Date(start.getTime());
  let cursor = new Date(start.getTime());
  let remaining = minutes;
  // Cap iterations to avoid infinite loops on a malformed calendar.
  for (let safety = 0; safety < 366 * 4; safety++) {
    const { dow, minOfDay, iso } = localOf(cursor, cal.timezoneOffsetMinutes);
    const windows = windowsFor(cal, dow, iso);

    for (const w of windows) {
      if (minOfDay >= w.end) continue;
      const blockStart = Math.max(minOfDay, w.start);
      const available = w.end - blockStart;
      if (available <= 0) continue;
      // Move the cursor forward to `blockStart` if needed.
      if (minOfDay < blockStart) {
        cursor = new Date(cursor.getTime() + (blockStart - minOfDay) * 60_000);
      }
      if (remaining <= available) {
        return new Date(cursor.getTime() + remaining * 60_000);
      }
      cursor = new Date(cursor.getTime() + available * 60_000);
      remaining -= available;
    }
    // No more time available today: jump to local midnight tomorrow.
    const { minOfDay: nowMin } = localOf(cursor, cal.timezoneOffsetMinutes);
    const toMidnight = 1440 - nowMin;
    cursor = new Date(cursor.getTime() + toMidnight * 60_000);
  }
  throw new Error("addBusinessMinutes: exceeded safety bound");
}

/** Compute target deadlines from a policy + calendar. */
export function calculateSlaTargets(input: {
  createdAt: Date;
  policy: SlaPolicy;
  calendar?: BusinessCalendar;
}): SlaTargets {
  const cal = input.calendar ?? ALWAYS_OPEN_UTC;
  return {
    firstResponseDueAt: addBusinessMinutes(
      input.createdAt,
      input.policy.firstResponseMinutes,
      cal,
    ),
    resolveDueAt: addBusinessMinutes(input.createdAt, input.policy.resolveMinutes, cal),
  };
}

/**
 * Compute a breach state. `pausedMs` adds slack when the request was on hold
 * (e.g. awaiting customer). `warnThresholdMs` defaults to 30 minutes.
 */
export function checkBreach(input: {
  target: Date;
  now: Date;
  pausedMs?: number;
  warnThresholdMs?: number;
}): BreachState {
  const paused = input.pausedMs ?? 0;
  const warn = input.warnThresholdMs ?? 30 * 60_000;
  const remainingMs = input.target.getTime() - input.now.getTime() + paused;
  return {
    remainingMs,
    breached: remainingMs <= 0,
    warning: remainingMs > 0 && remainingMs <= warn,
  };
}

/** Default per-priority SLA matrix. Caller may override per workspace. */
export const DEFAULT_SLA_BY_PRIORITY: Record<
  "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  SlaPolicy
> = {
  LOW: { firstResponseMinutes: 8 * 60, resolveMinutes: 5 * 24 * 60 },
  MEDIUM: { firstResponseMinutes: 4 * 60, resolveMinutes: 2 * 24 * 60 },
  HIGH: { firstResponseMinutes: 60, resolveMinutes: 8 * 60 },
  URGENT: { firstResponseMinutes: 15, resolveMinutes: 4 * 60 },
};
