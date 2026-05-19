/**
 * Pure date helpers powering the Calendar month-grid view. No React, no DOM,
 * no timezone trickery — all math is done in UTC.
 */

export type CalendarEvent<T = unknown> = {
  id: string;
  startsAt: Date;
  endsAt?: Date;
  title: string;
  /** Hex/css colour used by the renderer to tint the chip. */
  color?: string;
  /** Caller-defined payload preserved on the resulting cell. */
  data?: T;
};

export type CalendarCell<T = unknown> = {
  /** UTC midnight of the day. */
  date: Date;
  /** YYYY-MM-DD key. */
  iso: string;
  /** True when this day belongs to the active month. */
  inMonth: boolean;
  /** True when this day equals `today`. */
  isToday: boolean;
  /** Events that fall on this day, sorted by start time. */
  events: CalendarEvent<T>[];
};

/** UTC midnight for a YYYY-MM-DD or Date input. */
export function toUtcMidnight(input: Date | string): Date {
  const d = typeof input === "string" ? new Date(`${input}T00:00:00Z`) : input;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns true when [aS,aE) intersects [bS,bE). */
export function rangesOverlap(aS: Date, aE: Date, bS: Date, bE: Date): boolean {
  return aS.getTime() < bE.getTime() && bS.getTime() < aE.getTime();
}

/**
 * Build the 6-row × 7-col grid for a given month. The grid always starts on
 * `weekStartsOn` (0 = Sunday … 6 = Saturday) and includes leading/trailing
 * days from neighbouring months so each row has 7 cells.
 */
export function buildMonthGrid<T = unknown>(opts: {
  year: number;
  /** 1-12. */
  month: number;
  weekStartsOn?: number;
  events?: CalendarEvent<T>[];
  today?: Date;
}): CalendarCell<T>[] {
  const weekStart = (opts.weekStartsOn ?? 1) % 7;
  const today = opts.today ?? new Date();
  const todayIso = formatIso(toUtcMidnight(today));

  const firstOfMonth = new Date(Date.UTC(opts.year, opts.month - 1, 1));
  const firstDow = firstOfMonth.getUTCDay();
  const lead = (firstDow - weekStart + 7) % 7;
  const gridStart = new Date(firstOfMonth.getTime() - lead * 86_400_000);

  // Bucket events by ISO day for O(1) lookup per cell.
  const byDay = new Map<string, CalendarEvent<T>[]>();
  for (const ev of opts.events ?? []) {
    const start = toUtcMidnight(ev.startsAt);
    const end = toUtcMidnight(ev.endsAt ?? ev.startsAt);
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      const k = formatIso(cursor);
      const arr = byDay.get(k);
      if (arr) arr.push(ev);
      else byDay.set(k, [ev]);
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }
  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  const cells: CalendarCell<T>[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * 86_400_000);
    const iso = formatIso(d);
    cells.push({
      date: d,
      iso,
      inMonth: d.getUTCMonth() === opts.month - 1,
      isToday: iso === todayIso,
      events: byDay.get(iso) ?? [],
    });
  }
  return cells;
}

/** Names of weekdays starting at `weekStartsOn`, in `locale`. */
export function weekdayLabels(weekStartsOn = 1, locale = "en-US"): string[] {
  const out: string[] = [];
  // Pick a known Sunday in 2024 (Jan 7) as base.
  const base = new Date(Date.UTC(2024, 0, 7));
  for (let i = 0; i < 7; i++) {
    const dow = (weekStartsOn + i) % 7;
    const d = new Date(base.getTime() + dow * 86_400_000);
    out.push(d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }));
  }
  return out;
}
