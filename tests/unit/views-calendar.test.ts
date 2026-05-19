import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  formatIso,
  rangesOverlap,
  toUtcMidnight,
  weekdayLabels,
} from "@/platform/views/calendar";

describe("calendar helpers", () => {
  it("builds a 6x7 = 42 cell grid for any month", () => {
    const cells = buildMonthGrid({ year: 2025, month: 2, events: [] });
    expect(cells).toHaveLength(42);
    expect(cells[0].iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("marks days outside the active month with inMonth=false", () => {
    const cells = buildMonthGrid({ year: 2025, month: 2, events: [] });
    const inMonth = cells.filter((c) => c.inMonth);
    // Feb 2025 has 28 days
    expect(inMonth).toHaveLength(28);
  });

  it("flags `today` with isToday=true", () => {
    const today = new Date(Date.UTC(2025, 1, 14));
    const cells = buildMonthGrid({ year: 2025, month: 2, events: [], today });
    const todayCell = cells.find((c) => c.iso === "2025-02-14");
    expect(todayCell?.isToday).toBe(true);
  });

  it("buckets events into the days they span (multi-day)", () => {
    const events = [
      {
        id: "e1",
        startsAt: new Date(Date.UTC(2025, 1, 10)),
        endsAt: new Date(Date.UTC(2025, 1, 12)),
        title: "Trip",
      },
    ];
    const cells = buildMonthGrid({ year: 2025, month: 2, events });
    const days = cells.filter((c) => c.events.some((e) => e.id === "e1"));
    expect(days.map((d) => d.iso)).toEqual(["2025-02-10", "2025-02-11", "2025-02-12"]);
  });

  it("starts week on Monday by default", () => {
    const labels = weekdayLabels();
    expect(labels[0]).toMatch(/Mon/);
  });

  it("respects weekStartsOn=0 for US locales", () => {
    const labels = weekdayLabels(0, "en-US");
    expect(labels[0]).toMatch(/Sun/);
  });

  it("rangesOverlap detects intersecting half-open ranges", () => {
    expect(
      rangesOverlap(
        new Date("2025-01-01"),
        new Date("2025-01-03"),
        new Date("2025-01-02"),
        new Date("2025-01-04"),
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        new Date("2025-01-01"),
        new Date("2025-01-02"),
        new Date("2025-01-02"),
        new Date("2025-01-03"),
      ),
    ).toBe(false);
  });

  it("formatIso always emits zero-padded YYYY-MM-DD", () => {
    expect(formatIso(toUtcMidnight(new Date(Date.UTC(2025, 0, 5))))).toBe("2025-01-05");
  });
});
