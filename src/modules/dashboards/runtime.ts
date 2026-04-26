import { prisma } from "@/lib/prisma";
import type { DashboardWidget } from "@prisma/client";
import { SOURCE_CATALOG } from "./schemas";

export type WidgetResultBucket = { key: string; label: string; value: number };

export type WidgetResult =
  | { kind: "KPI"; total: number; rangeDays: number }
  | { kind: "BAR" | "PIE" | "TABLE"; buckets: WidgetResultBucket[]; total: number }
  | { kind: "LINE"; series: Array<{ date: string; value: number }>; total: number }
  | { kind: "ERROR"; error: string };

type Delegate = {
  groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
  aggregate: (args: unknown) => Promise<{ _count?: number | { _all?: number }; _sum?: Record<string, unknown>; _avg?: Record<string, unknown> }>;
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
};

function delegateFor(source: DashboardWidget["source"]): Delegate {
  switch (source) {
    case "DEAL":
      return prisma.deal as unknown as Delegate;
    case "INVOICE":
      return prisma.invoice as unknown as Delegate;
    case "CONTACT":
      return prisma.contact as unknown as Delegate;
    case "TICKET":
      return prisma.ticket as unknown as Delegate;
    case "TASK":
      return prisma.task as unknown as Delegate;
    case "PROJECT":
      return prisma.project as unknown as Delegate;
    case "EXPENSE":
      return prisma.expense as unknown as Delegate;
    case "SUBSCRIPTION":
      return prisma.subscription as unknown as Delegate;
    case "SUBSCRIPTION_INVOICE":
      return prisma.subscriptionInvoice as unknown as Delegate;
    case "CAMPAIGN":
      return prisma.campaign as unknown as Delegate;
  }
}

function dateFilter(source: DashboardWidget["source"], rangeDays: number): Record<string, { gte: Date }> {
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
  const field = SOURCE_CATALOG[source].dateField;
  return { [field]: { gte: since } };
}

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

function bucketLabel(value: unknown): string {
  if (value === null || value === undefined) return "(none)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export async function runWidget(widget: DashboardWidget, workspaceId: string): Promise<WidgetResult> {
  try {
    const where = { workspaceId, ...dateFilter(widget.source, widget.rangeDays) };
    const delegate = delegateFor(widget.source);

    if (widget.kind === "KPI") {
      const agg = await delegate.aggregate({
        where,
        ...(widget.metric === "COUNT"
          ? { _count: true }
          : widget.metric === "SUM"
          ? { _sum: { [widget.metricField as string]: true } }
          : { _avg: { [widget.metricField as string]: true } }),
      });
      let total = 0;
      if (widget.metric === "COUNT") {
        total = typeof agg._count === "number" ? agg._count : agg._count?._all ?? 0;
      } else if (widget.metric === "SUM") {
        total = toNumber(agg._sum?.[widget.metricField as string]);
      } else {
        total = toNumber(agg._avg?.[widget.metricField as string]);
      }
      return { kind: "KPI", total, rangeDays: widget.rangeDays };
    }

    if (widget.kind === "LINE") {
      const dateField = SOURCE_CATALOG[widget.source].dateField;
      const select: Record<string, boolean> = { [dateField]: true };
      if (widget.metric !== "COUNT" && widget.metricField) select[widget.metricField] = true;
      const rows = await delegate.findMany({ where, select });
      const days: Record<string, number> = {};
      for (let i = widget.rangeDays - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        days[d] = 0;
      }
      let total = 0;
      for (const r of rows) {
        const raw = r[dateField];
        if (!(raw instanceof Date)) continue;
        const d = raw.toISOString().slice(0, 10);
        if (!(d in days)) continue;
        const v = widget.metric === "COUNT" ? 1 : toNumber(r[widget.metricField as string]);
        days[d] += v;
        total += v;
      }
      const series = Object.entries(days).map(([date, value]) => ({ date, value }));
      if (widget.metric === "AVG") {
        const nonZero = series.filter((s) => s.value !== 0).length || 1;
        return { kind: "LINE", series, total: total / nonZero };
      }
      return { kind: "LINE", series, total };
    }

    // BAR | PIE | TABLE — groupBy
    if (!widget.groupBy) return { kind: "ERROR", error: "groupBy required" };
    const args: Record<string, unknown> = {
      by: [widget.groupBy],
      where,
      orderBy: undefined,
    };
    if (widget.metric === "COUNT") {
      args._count = { _all: true };
    } else if (widget.metric === "SUM") {
      args._sum = { [widget.metricField as string]: true };
    } else {
      args._avg = { [widget.metricField as string]: true };
    }
    const rows = (await delegate.groupBy(args)) as Array<Record<string, unknown> & { _count?: { _all?: number }; _sum?: Record<string, unknown>; _avg?: Record<string, unknown> }>;
    const buckets: WidgetResultBucket[] = rows.map((r) => {
      const key = bucketLabel(r[widget.groupBy as string]);
      const value =
        widget.metric === "COUNT"
          ? r._count?._all ?? 0
          : widget.metric === "SUM"
          ? toNumber(r._sum?.[widget.metricField as string])
          : toNumber(r._avg?.[widget.metricField as string]);
      return { key, label: key, value };
    });
    buckets.sort((a, b) => b.value - a.value);
    const total = buckets.reduce((s, b) => s + b.value, 0);
    return { kind: widget.kind, buckets, total };
  } catch (err) {
    return { kind: "ERROR", error: err instanceof Error ? err.message : "Failed to run widget" };
  }
}
