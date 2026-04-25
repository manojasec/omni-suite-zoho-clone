import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const SUB_DASHBOARDS = [
  { href: "/app/reports/crm", label: "CRM" },
  { href: "/app/reports/sales", label: "Sales pipeline" },
  { href: "/app/reports/billing", label: "Revenue & invoices" },
  { href: "/app/reports/projects", label: "Projects" },
  { href: "/app/reports/helpdesk", label: "Helpdesk" },
  { href: "/app/reports/campaigns", label: "Campaigns" },
  { href: "/app/reports/inventory", label: "Inventory" },
  { href: "/app/reports/expenses", label: "Expenses" },
  { href: "/app/reports/hr", label: "HR" },
  { href: "/app/reports/esign", label: "E-Signature" },
  { href: "/app/reports/bookings", label: "Bookings" },
  { href: "/app/reports/issues", label: "Issues & bugs" },
  { href: "/app/reports/operations", label: "Operations (chat / mail / automation)" },
];

export default async function ReportsHubPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const months = lastNMonths(12);

  const [
    contactCount,
    openDealValue,
    paidInvoices,
    openInvoiceBalance,
    openTickets,
    activeProjects,
    completedTasks,
    sentCampaigns,
    revenueRows,
  ] = await Promise.all([
    prisma.contact.count({ where: { workspaceId: wsId } }),
    prisma.deal.aggregate({ where: { workspaceId: wsId, status: "OPEN" }, _sum: { value: true } }),
    prisma.invoice.aggregate({ where: { workspaceId: wsId, status: "PAID" }, _sum: { total: true } }),
    prisma.invoice.aggregate({
      where: { workspaceId: wsId, status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] } },
      _sum: { balance: true },
    }),
    prisma.ticket.count({ where: { workspaceId: wsId, status: { in: ["OPEN", "PENDING"] } } }),
    prisma.project.count({ where: { workspaceId: wsId, status: "ACTIVE" } }),
    prisma.task.count({ where: { workspaceId: wsId, status: "DONE", updatedAt: { gte: since } } }),
    prisma.campaign.count({ where: { workspaceId: wsId, status: "SENT" } }),
    prisma.invoice.findMany({
      where: { workspaceId: wsId, status: "PAID", updatedAt: { gte: months[0].from } },
      select: { total: true, updatedAt: true },
    }),
  ]);

  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  const revenueSeries = bucketByMonth(
    revenueRows.map((r) => ({ createdAt: r.updatedAt, value: Number(r.total) })),
    months,
    (r) => r.value,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Executive overview across your workspace.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pipeline (open)" value={formatCurrency(Number(openDealValue._sum.value ?? 0), currency)} />
        <StatCard title="Revenue (paid)" value={formatCurrency(Number(paidInvoices._sum.total ?? 0), currency)} />
        <StatCard title="A/R outstanding" value={formatCurrency(Number(openInvoiceBalance._sum.balance ?? 0), currency)} />
        <StatCard title="Contacts" value={contactCount.toLocaleString()} />
        <StatCard title="Open tickets" value={openTickets.toLocaleString()} />
        <StatCard title="Active projects" value={activeProjects.toLocaleString()} />
        <StatCard title="Tasks done (12mo)" value={completedTasks.toLocaleString()} />
        <StatCard title="Campaigns sent" value={sentCampaigns.toLocaleString()} />
      </div>

      <LineChart
        title="Revenue (last 12 months)"
        points={revenueSeries}
        formatValue={(v) => formatCurrency(v, currency)}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Drill down</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUB_DASHBOARDS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="rounded-md border bg-card p-3 text-sm font-medium hover:bg-accent"
            >
              {d.label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
