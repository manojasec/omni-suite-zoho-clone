import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatCard, LineChart, BarList } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID"] as const;

export default async function BillingAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStatus, openAgg, overdueAgg, paidAgg, revenueRows] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["status"],
      where: { workspaceId: wsId },
      _count: { _all: true },
      _sum: { total: true, balance: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: wsId, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      _sum: { balance: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: wsId, status: "OVERDUE" },
      _sum: { balance: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({
      where: { workspaceId: wsId, status: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.invoice.findMany({
      where: { workspaceId: wsId, status: "PAID", updatedAt: { gte: months[0].from } },
      select: { total: true, updatedAt: true },
    }),
  ]);

  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  const statusMap = new Map(byStatus.map((b) => [b.status, b]));
  const statusSeries = STATUSES.map((s) => ({
    label: s,
    value: statusMap.get(s)?._count._all ?? 0,
    sub: formatCurrency(Number(statusMap.get(s)?._sum.total ?? 0), currency),
  }));

  const revenueSeries = bucketByMonth(
    revenueRows.map((r) => ({ createdAt: r.updatedAt, value: Number(r.total) })),
    months,
    (r) => r.value,
  );

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Revenue & invoices</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Revenue (paid)" value={formatCurrency(Number(paidAgg._sum.total ?? 0), currency)} hint={`${paidAgg._count._all} invoices`} />
        <StatCard title="Outstanding" value={formatCurrency(Number(openAgg._sum.balance ?? 0), currency)} />
        <StatCard title="Overdue" value={formatCurrency(Number(overdueAgg._sum.balance ?? 0), currency)} hint={`${overdueAgg._count._all} invoices`} />
        <StatCard title="Total invoices" value={byStatus.reduce((a, b) => a + b._count._all, 0).toLocaleString()} />
      </div>

      <LineChart
        title="Revenue (last 12 months)"
        points={revenueSeries}
        formatValue={(v) => formatCurrency(v, currency)}
      />

      <BarList title="Invoices by status" series={statusSeries} />
    </div>
  );
}
