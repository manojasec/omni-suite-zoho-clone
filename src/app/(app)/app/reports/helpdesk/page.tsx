import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "PENDING", "ON_HOLD", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export default async function HelpdeskAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const [byStatus, byPriority, resolvedTickets, total] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.ticket.findMany({
      where: { workspaceId: wsId, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 1000,
    }),
    prisma.ticket.count({ where: { workspaceId: wsId } }),
  ]);

  const ss = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const ps = new Map(byPriority.map((b) => [b.priority, b._count._all]));

  let avgHours = 0;
  if (resolvedTickets.length > 0) {
    const totalMs = resolvedTickets.reduce(
      (acc, t) => acc + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
      0,
    );
    avgHours = Math.round((totalMs / resolvedTickets.length) / (1000 * 60 * 60));
  }

  const open = (ss.get("OPEN") ?? 0) + (ss.get("PENDING") ?? 0);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Helpdesk analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Total tickets" value={total.toLocaleString()} />
        <StatCard title="Open / pending" value={open.toLocaleString()} />
        <StatCard title="Resolved" value={(ss.get("RESOLVED") ?? 0).toLocaleString()} />
        <StatCard title="Avg resolution" value={`${avgHours}h`} hint={`${resolvedTickets.length} sample`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Tickets by status" series={STATUSES.map((s) => ({ label: s, value: ss.get(s) ?? 0 }))} />
        <BarList title="Tickets by priority" series={PRIORITIES.map((p) => ({ label: p, value: ps.get(p) ?? 0 }))} />
      </div>
    </div>
  );
}
