import { describe, expect, it } from "vitest";
import { computeSlots, parseISODate, overlaps } from "@/modules/bookings/slots";

const MON = parseISODate("2099-01-05")!; // Monday (UTC)

describe("computeSlots", () => {
  it("returns empty when no availability matches the day", () => {
    const slots = computeSlots(
      [{ dayOfWeek: 6, startMinutes: 9 * 60, endMinutes: 17 * 60 }], // Saturday only
      [],
      { date: MON, durationMins: 30, bufferMins: 0, now: new Date("2000-01-01") },
    );
    expect(slots).toHaveLength(0);
  });

  it("generates 30-minute slots inside a 9–11 window", () => {
    const slots = computeSlots(
      [{ dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 11 * 60 }],
      [],
      { date: MON, durationMins: 30, bufferMins: 0, now: new Date("2000-01-01") },
    );
    expect(slots.map((s) => s.toISOString().slice(11, 16))).toEqual([
      "09:00", "09:30", "10:00", "10:30",
    ]);
  });

  it("excludes slots that are in the past", () => {
    const now = new Date("2099-01-05T10:00:00.000Z");
    const slots = computeSlots(
      [{ dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 }],
      [],
      { date: MON, durationMins: 60, bufferMins: 0, now },
    );
    expect(slots.map((s) => s.toISOString().slice(11, 16))).toEqual(["11:00"]);
  });

  it("blocks overlapping slots considering buffer", () => {
    const existing = [{
      startsAt: new Date("2099-01-05T10:00:00.000Z"),
      endsAt: new Date("2099-01-05T10:30:00.000Z"),
    }];
    const slots = computeSlots(
      [{ dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 }],
      existing,
      { date: MON, durationMins: 30, bufferMins: 15, now: new Date("2000-01-01") },
    );
    const labels = slots.map((s) => s.toISOString().slice(11, 16));
    // 10:00 itself blocked, 09:30 blocked by buffer, 10:30 blocked by buffer.
    expect(labels).toEqual(["09:00", "11:00", "11:30"]);
  });

  it("rejects an invalid duration", () => {
    expect(
      computeSlots([], [], {
        date: MON,
        durationMins: 0,
        bufferMins: 0,
        now: new Date("2000-01-01"),
      }),
    ).toEqual([]);
  });

  it("dedupes overlapping windows on the same day", () => {
    const slots = computeSlots(
      [
        { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 10 * 60 },
        { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 10 * 60 },
      ],
      [],
      { date: MON, durationMins: 30, bufferMins: 0, now: new Date("2000-01-01") },
    );
    expect(slots.map((s) => s.toISOString().slice(11, 16))).toEqual(["09:00", "09:30"]);
  });
});

describe("parseISODate", () => {
  it("parses YYYY-MM-DD", () => {
    expect(parseISODate("2099-01-05")?.toISOString()).toBe("2099-01-05T00:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(parseISODate("not-a-date")).toBeNull();
    expect(parseISODate("2099-1-5")).toBeNull();
  });
});

describe("overlaps", () => {
  it("returns true for overlapping intervals", () => {
    expect(
      overlaps(
        new Date("2099-01-01T10:00:00Z"),
        new Date("2099-01-01T11:00:00Z"),
        new Date("2099-01-01T10:30:00Z"),
        new Date("2099-01-01T11:30:00Z"),
      ),
    ).toBe(true);
  });

  it("returns false for adjacent intervals (touch only)", () => {
    expect(
      overlaps(
        new Date("2099-01-01T10:00:00Z"),
        new Date("2099-01-01T11:00:00Z"),
        new Date("2099-01-01T11:00:00Z"),
        new Date("2099-01-01T12:00:00Z"),
      ),
    ).toBe(false);
  });
});
