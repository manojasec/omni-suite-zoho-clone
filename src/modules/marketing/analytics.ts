/**
 * Marketing analytics — pure aggregators.
 *
 * Operates over raw send/open/click event logs. Returns per-campaign rates
 * and ranks the top clicked URLs. Decoupled from Prisma so it can be reused
 * by API routes, BI dashboards, and unit tests.
 */

export interface MarketingEvent {
  campaignId: string;
  contactId: string;
  type: "SENT" | "DELIVERED" | "BOUNCED" | "OPENED" | "CLICKED" | "UNSUBSCRIBED";
  url?: string;
  createdAt: Date;
}

export interface CampaignMetrics {
  campaignId: string;
  sent: number;
  delivered: number;
  bounced: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  openRate: number; // 0..1
  clickRate: number; // 0..1
  clickToOpenRate: number; // 0..1
}

export function aggregateCampaign(campaignId: string, events: MarketingEvent[]): CampaignMetrics {
  const own = events.filter((e) => e.campaignId === campaignId);
  const sent = own.filter((e) => e.type === "SENT").length;
  const delivered = own.filter((e) => e.type === "DELIVERED").length;
  const bounced = own.filter((e) => e.type === "BOUNCED").length;
  const unsubscribes = own.filter((e) => e.type === "UNSUBSCRIBED").length;
  const uniqueOpens = unique(own.filter((e) => e.type === "OPENED").map((e) => e.contactId)).length;
  const uniqueClicks = unique(own.filter((e) => e.type === "CLICKED").map((e) => e.contactId)).length;
  const base = delivered > 0 ? delivered : sent;
  return {
    campaignId,
    sent,
    delivered,
    bounced,
    uniqueOpens,
    uniqueClicks,
    unsubscribes,
    openRate: base > 0 ? uniqueOpens / base : 0,
    clickRate: base > 0 ? uniqueClicks / base : 0,
    clickToOpenRate: uniqueOpens > 0 ? uniqueClicks / uniqueOpens : 0,
  };
}

function unique<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Rank distinct URLs by unique clickers, descending. Returns up to `limit`
 * entries with `{url, clicks, uniqueClickers}`.
 */
export function topClickedUrls(
  events: MarketingEvent[],
  limit = 10,
): { url: string; clicks: number; uniqueClickers: number }[] {
  const byUrl = new Map<string, { clicks: number; clickers: Set<string> }>();
  for (const e of events) {
    if (e.type !== "CLICKED" || !e.url) continue;
    let bucket = byUrl.get(e.url);
    if (!bucket) {
      bucket = { clicks: 0, clickers: new Set() };
      byUrl.set(e.url, bucket);
    }
    bucket.clicks += 1;
    bucket.clickers.add(e.contactId);
  }
  return Array.from(byUrl.entries())
    .map(([url, b]) => ({ url, clicks: b.clicks, uniqueClickers: b.clickers.size }))
    .sort((a, b) => b.uniqueClickers - a.uniqueClickers || b.clicks - a.clicks)
    .slice(0, limit);
}

/**
 * Bucket events into daily counts of `{day, sent, opened, clicked}` for the
 * given campaign. Days are ISO YYYY-MM-DD in UTC.
 */
export function dailyCohort(
  campaignId: string,
  events: MarketingEvent[],
): { day: string; sent: number; opened: number; clicked: number }[] {
  const own = events.filter((e) => e.campaignId === campaignId);
  const buckets = new Map<string, { sent: number; opened: number; clicked: number }>();
  for (const e of own) {
    const day = e.createdAt.toISOString().slice(0, 10);
    let b = buckets.get(day);
    if (!b) {
      b = { sent: 0, opened: 0, clicked: 0 };
      buckets.set(day, b);
    }
    if (e.type === "SENT") b.sent += 1;
    else if (e.type === "OPENED") b.opened += 1;
    else if (e.type === "CLICKED") b.clicked += 1;
  }
  return Array.from(buckets.entries())
    .map(([day, b]) => ({ day, ...b }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Workspace-level rollup: total sends + average open/click across all
 * campaigns. Returned rates are simple means, not delivery-weighted.
 */
export function workspaceRollup(events: MarketingEvent[]): {
  campaigns: number;
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
} {
  const campaignIds = unique(events.map((e) => e.campaignId));
  const metrics = campaignIds.map((id) => aggregateCampaign(id, events));
  const n = metrics.length;
  return {
    campaigns: n,
    totalSent: metrics.reduce((s, m) => s + m.sent, 0),
    avgOpenRate: n > 0 ? metrics.reduce((s, m) => s + m.openRate, 0) / n : 0,
    avgClickRate: n > 0 ? metrics.reduce((s, m) => s + m.clickRate, 0) / n : 0,
  };
}
