import { describe, it, expect } from "vitest";
import {
  aggregateCampaign,
  dailyCohort,
  topClickedUrls,
  workspaceRollup,
  type MarketingEvent,
} from "@/modules/marketing/analytics";

const evs: MarketingEvent[] = [
  { campaignId: "c1", contactId: "u1", type: "SENT", createdAt: new Date("2026-05-01T10:00:00Z") },
  { campaignId: "c1", contactId: "u2", type: "SENT", createdAt: new Date("2026-05-01T10:00:00Z") },
  { campaignId: "c1", contactId: "u3", type: "SENT", createdAt: new Date("2026-05-02T10:00:00Z") },
  { campaignId: "c1", contactId: "u1", type: "DELIVERED", createdAt: new Date("2026-05-01T10:01:00Z") },
  { campaignId: "c1", contactId: "u2", type: "DELIVERED", createdAt: new Date("2026-05-01T10:01:00Z") },
  { campaignId: "c1", contactId: "u3", type: "BOUNCED", createdAt: new Date("2026-05-02T10:01:00Z") },
  { campaignId: "c1", contactId: "u1", type: "OPENED", createdAt: new Date("2026-05-01T11:00:00Z") },
  { campaignId: "c1", contactId: "u1", type: "OPENED", createdAt: new Date("2026-05-01T11:05:00Z") }, // dedup
  { campaignId: "c1", contactId: "u2", type: "OPENED", createdAt: new Date("2026-05-01T11:30:00Z") },
  { campaignId: "c1", contactId: "u1", type: "CLICKED", url: "https://x/y", createdAt: new Date("2026-05-01T12:00:00Z") },
  { campaignId: "c2", contactId: "v1", type: "SENT", createdAt: new Date("2026-05-03T10:00:00Z") },
];

describe("marketing analytics — aggregateCampaign", () => {
  it("computes counts and rates", () => {
    const m = aggregateCampaign("c1", evs);
    expect(m.sent).toBe(3);
    expect(m.delivered).toBe(2);
    expect(m.bounced).toBe(1);
    expect(m.uniqueOpens).toBe(2);
    expect(m.uniqueClicks).toBe(1);
    expect(m.openRate).toBeCloseTo(2 / 2, 5);
    expect(m.clickRate).toBeCloseTo(1 / 2, 5);
    expect(m.clickToOpenRate).toBeCloseTo(1 / 2, 5);
  });

  it("falls back to sent when delivered=0", () => {
    const onlySent: MarketingEvent[] = [
      { campaignId: "x", contactId: "u1", type: "SENT", createdAt: new Date() },
      { campaignId: "x", contactId: "u2", type: "SENT", createdAt: new Date() },
      { campaignId: "x", contactId: "u1", type: "OPENED", createdAt: new Date() },
    ];
    expect(aggregateCampaign("x", onlySent).openRate).toBeCloseTo(1 / 2, 5);
  });

  it("returns zero rates for unknown campaign", () => {
    const m = aggregateCampaign("never", evs);
    expect(m.openRate).toBe(0);
    expect(m.clickToOpenRate).toBe(0);
  });
});

describe("marketing analytics — topClickedUrls", () => {
  it("ranks URLs by unique clickers", () => {
    const more: MarketingEvent[] = [
      ...evs,
      { campaignId: "c1", contactId: "u2", type: "CLICKED", url: "https://x/y", createdAt: new Date() },
      { campaignId: "c1", contactId: "u1", type: "CLICKED", url: "https://other", createdAt: new Date() },
    ];
    const top = topClickedUrls(more);
    expect(top[0]?.url).toBe("https://x/y");
    expect(top[0]?.uniqueClickers).toBe(2);
    expect(top[1]?.url).toBe("https://other");
  });

  it("respects the limit argument", () => {
    expect(topClickedUrls(evs, 0)).toEqual([]);
  });
});

describe("marketing analytics — dailyCohort + workspaceRollup", () => {
  it("buckets events by ISO day", () => {
    const c = dailyCohort("c1", evs);
    const day1 = c.find((d) => d.day === "2026-05-01");
    expect(day1).toMatchObject({ sent: 2, opened: 3, clicked: 1 });
    const day2 = c.find((d) => d.day === "2026-05-02");
    expect(day2?.sent).toBe(1);
  });

  it("rollup counts campaigns and averages rates", () => {
    const r = workspaceRollup(evs);
    expect(r.campaigns).toBe(2);
    expect(r.totalSent).toBe(4);
    expect(r.avgOpenRate).toBeGreaterThan(0);
  });
});
