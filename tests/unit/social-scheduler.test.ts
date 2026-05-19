import { describe, it, expect } from "vitest";
import { planSchedule, selectDuePosts, type ScheduledPostLite } from "@/modules/social/scheduler";

const now = new Date("2026-05-09T10:00:00Z");

function post(overrides: Partial<ScheduledPostLite> = {}): ScheduledPostLite {
  return {
    id: "p1",
    status: "SCHEDULED",
    scheduledAt: new Date(now.getTime() - 60_000),
    body: "Hello world",
    targets: [{ platform: "TWITTER", accountId: "a1" }],
    ...overrides,
  };
}

describe("social scheduler — selectDuePosts", () => {
  it("picks SCHEDULED posts whose scheduledAt <= now", () => {
    const r = selectDuePosts([post(), post({ id: "p2", scheduledAt: new Date(now.getTime() + 60_000) })], now);
    expect(r.due.map((p) => p.id)).toEqual(["p1"]);
    expect(r.rejected).toEqual([]);
  });

  it("ignores non-SCHEDULED posts", () => {
    const r = selectDuePosts([post({ status: "DRAFT" }), post({ id: "p2", status: "PUBLISHED" })], now);
    expect(r.due).toEqual([]);
  });

  it("rejects posts with no targets", () => {
    const r = selectDuePosts([post({ targets: [] })], now);
    expect(r.due).toEqual([]);
    expect(r.rejected[0]?.reason).toBe("no-targets");
  });

  it("rejects posts whose body exceeds a target platform limit", () => {
    const r = selectDuePosts([post({ body: "x".repeat(281) })], now);
    expect(r.due).toEqual([]);
    expect(r.rejected[0]?.reason).toMatch(/twitter/);
  });

  it("allows long posts when only LinkedIn is targeted", () => {
    const r = selectDuePosts([post({ body: "x".repeat(2000), targets: [{ platform: "LINKEDIN", accountId: "a" }] })], now);
    expect(r.due).toHaveLength(1);
  });
});

describe("social scheduler — planSchedule", () => {
  it("returns N evenly-spaced future timestamps", () => {
    const start = new Date(now.getTime() + 60_000);
    const slots = planSchedule(start, 3600_000, 3, now);
    expect(slots).toHaveLength(3);
    expect(slots[1]!.getTime() - slots[0]!.getTime()).toBe(3_600_000);
  });

  it("drops past timestamps", () => {
    const start = new Date(now.getTime() - 7_200_000);
    const slots = planSchedule(start, 3_600_000, 3, now);
    // first two slots are -2h and -1h (past), third is exactly now → kept
    expect(slots).toHaveLength(1);
  });

  it("returns empty on non-positive counts/intervals", () => {
    expect(planSchedule(now, 0, 5)).toEqual([]);
    expect(planSchedule(now, 1000, 0)).toEqual([]);
  });
});
