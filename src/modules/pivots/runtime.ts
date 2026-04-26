import { prisma } from "@/lib/prisma";
import type { PivotReport, WidgetSource } from "@prisma/client";
import { SOURCE_CATALOG } from "@/modules/dashboards/schemas";

export type PivotResult = {
  rows: Array<{ key: string; total: number }>;
  cols: Array<{ key: string; total: number }>; // empty if no colField
  cells: Record<string, Record<string, number>>; // [rowKey][colKey] = value (colKey="_total" when no colField)
  grandTotal: number;
  hasColField: boolean;
};

type Delegate = {
  groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
};

function delegateFor(source: WidgetSource): Delegate {
  switch (source) {
    case "DEAL": return prisma.deal as unknown as Delegate;
    case "INVOICE": return prisma.invoice as unknown as Delegate;
    case "CONTACT": return prisma.contact as unknown as Delegate;
    case "TICKET": return prisma.ticket as unknown as Delegate;
    case "TASK": return prisma.task as unknown as Delegate;
    case "PROJECT": return prisma.project as unknown as Delegate;
    case "EXPENSE": return prisma.expense as unknown as Delegate;
    case "SUBSCRIPTION": return prisma.subscription as unknown as Delegate;
    case "SUBSCRIPTION_INVOICE": return prisma.subscriptionInvoice as unknown as Delegate;
    case "CAMPAIGN": return prisma.campaign as unknown as Delegate;
  }
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

export async function runPivot(report: PivotReport, workspaceId: string): Promise<PivotResult> {
  const dateField = SOURCE_CATALOG[report.source].dateField;
  const since = new Date(Date.now() - report.rangeDays * 24 * 60 * 60 * 1000);
  const where: Record<string, unknown> = { workspaceId, [dateField]: { gte: since } };

  const by = report.colField ? [report.rowField, report.colField] : [report.rowField];
  const args: Record<string, unknown> = { by, where };
  if (report.valueMetric === "COUNT") {
    args._count = { _all: true };
  } else if (report.valueMetric === "SUM") {
    args._sum = { [report.valueField as string]: true };
  } else {
    args._avg = { [report.valueField as string]: true };
  }

  const delegate = delegateFor(report.source);
  const rows = (await delegate.groupBy(args)) as Array<
    Record<string, unknown> & {
      _count?: { _all?: number };
      _sum?: Record<string, unknown>;
      _avg?: Record<string, unknown>;
    }
  >;

  const cells: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const r of rows) {
    const rk = bucketLabel(r[report.rowField]);
    const ck = report.colField ? bucketLabel(r[report.colField]) : "_total";
    const v =
      report.valueMetric === "COUNT"
        ? r._count?._all ?? 0
        : report.valueMetric === "SUM"
        ? toNumber(r._sum?.[report.valueField as string])
        : toNumber(r._avg?.[report.valueField as string]);
    cells[rk] = cells[rk] ?? {};
    cells[rk][ck] = (cells[rk][ck] ?? 0) + v;
    rowTotals[rk] = (rowTotals[rk] ?? 0) + v;
    colTotals[ck] = (colTotals[ck] ?? 0) + v;
    grandTotal += v;
  }

  const sortedRows = Object.entries(rowTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([key, total]) => ({ key, total }));
  const sortedCols = report.colField
    ? Object.entries(colTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([key, total]) => ({ key, total }))
    : [];

  return {
    rows: sortedRows,
    cols: sortedCols,
    cells,
    grandTotal,
    hasColField: !!report.colField,
  };
}
