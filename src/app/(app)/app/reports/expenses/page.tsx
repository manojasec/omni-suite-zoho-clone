import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"] as const;

export default async function ExpensesAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStatus, totals, recent, byCategoryRaw, categories] = await Promise.all([
    prisma.expense.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.expense.aggregate({ where: { workspaceId: wsId }, _count: { _all: true }, _sum: { amount: true } }),
    prisma.expense.findMany({
      where: { workspaceId: wsId, expenseDate: { gte: months[0].from } },
      select: { expenseDate: true, amount: true, status: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { workspaceId: wsId, status: { in: ["APPROVED", "REIMBURSED"] } },
      _sum: { amount: true },
    }),
    prisma.expenseCategory.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true } }),
  ]);

  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  const statusCounts = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const statusSums = new Map(byStatus.map((b) => [b.status, Number(b._sum.amount ?? 0)]));

  const approvedReimbursed = (statusSums.get("APPROVED") ?? 0) + (statusSums.get("REIMBURSED") ?? 0);
  const pending = statusSums.get("SUBMITTED") ?? 0;

  const monthlySpend = bucketByMonth(
    recent
      .filter((r) => r.status === "APPROVED" || r.status === "REIMBURSED")
      .map((r) => ({ createdAt: r.expenseDate, value: Number(r.amount) })),
    months,
    (r) => r.value,
  );

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = byCategoryRaw
    .map((b) => ({
      label: b.categoryId ? catName.get(b.categoryId) ?? "Unknown" : "Uncategorized",
      value: Math.round(Number(b._sum.amount ?? 0)),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Expenses analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Total expenses" value={(totals._count._all ?? 0).toLocaleString()} />
        <StatCard title="Total amount" value={formatCurrency(Number(totals._sum.amount ?? 0), currency)} />
        <StatCard title="Approved + reimbursed" value={formatCurrency(approvedReimbursed, currency)} />
        <StatCard title="Pending approval" value={formatCurrency(pending, currency)} hint={`${statusCounts.get("SUBMITTED") ?? 0} expenses`} />
      </div>

      <LineChart
        title="Approved spend (last 12 months)"
        points={monthlySpend}
        formatValue={(v) => formatCurrency(v, currency)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Spend by category (approved + reimbursed)"
          series={byCategory.slice(0, 10)}
          formatValue={(v) => formatCurrency(v, currency)}
        />
        <BarList
          title="Expenses by status"
          series={STATUSES.map((s) => ({
            label: s,
            value: statusCounts.get(s) ?? 0,
            sub: formatCurrency(statusSums.get(s) ?? 0, currency),
          }))}
        />
      </div>
    </div>
  );
}
