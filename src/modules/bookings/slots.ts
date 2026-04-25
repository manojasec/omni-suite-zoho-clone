/**
 * Slot computation for booking types.
 *
 * Given a `BookingType` (durationMins, bufferMins) plus its weekly
 * `BookingAvailability` rows and the set of existing non-cancelled bookings
 * within a target day, return the candidate ISO start times the visitor can
 * pick.
 *
 * For MVP we treat all times as UTC. Production should localise to either the
 * host's timezone or the workspace timezone — but the math is identical.
 */

export type AvailabilityWindow = {
  dayOfWeek: number; // 0 = Sunday
  startMinutes: number;
  endMinutes: number;
};

export type ExistingBooking = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotOptions = {
  date: Date; // local "day" at 00:00 UTC
  durationMins: number;
  bufferMins: number;
  step?: number; // grid step in minutes; defaults to durationMins
  now?: Date;
};

/** Returns true if [aStart, aEnd) overlaps [bStart, bEnd). */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function computeSlots(
  windows: AvailabilityWindow[],
  bookings: ExistingBooking[],
  opts: SlotOptions,
): Date[] {
  const { date, durationMins, bufferMins } = opts;
  if (durationMins <= 0) return [];
  const step = Math.max(5, opts.step ?? durationMins);
  const now = opts.now ?? new Date();

  const dayOfWeek = date.getUTCDay();
  const dayWindows = windows.filter((w) => w.dayOfWeek === dayOfWeek);
  if (dayWindows.length === 0) return [];

  const dayStart = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const slots: Date[] = [];
  for (const w of dayWindows) {
    let cursor = w.startMinutes;
    while (cursor + durationMins <= w.endMinutes) {
      const startsAt = new Date(dayStart.getTime() + cursor * 60_000);
      const endsAt = new Date(startsAt.getTime() + durationMins * 60_000);
      if (startsAt > now) {
        const conflict = bookings.some((b) =>
          overlaps(
            new Date(b.startsAt.getTime() - bufferMins * 60_000),
            new Date(b.endsAt.getTime() + bufferMins * 60_000),
            startsAt,
            endsAt,
          ),
        );
        if (!conflict) slots.push(startsAt);
      }
      cursor += step;
    }
  }
  // Dedupe identical timestamps (e.g. overlapping windows) and sort.
  const seen = new Set<number>();
  return slots
    .filter((d) => {
      if (seen.has(d.getTime())) return false;
      seen.add(d.getTime());
      return true;
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Convert a YYYY-MM-DD string to a UTC midnight Date.
 * Returns null if invalid.
 */
export function parseISODate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const d = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(d.getTime()) ? null : d;
}
