import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const SEVERITIES = ["TRIVIAL", "MINOR", "MAJOR", "CRITICAL", "BLOCKER"] as const;
const TYPES = ["BUG", "FEATURE", "TASK", "IMPROVEMENT"] as const;

export default async function IssuesAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStatus, byPriority, bySeverity, byType, byProject, projects, total, resolvedRows, recent] = await Promise.all([
    prisma.issue.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["priority"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["severity"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.issue.groupBy({ by: ["type"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.issue.groupBy({
      by: ["projectId"],
      where: { workspaceId: wsId, status: { in: ["OPEN", "IN_PROGRESS", "REOPENED"] } },
      _count: { _all: true },
    }),
    prisma.issueProject.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true, key: true } }),
    prisma.issue.count({ where: { workspaceId: wsId } }),
    prisma.issue.findMany({
      where: { workspaceId: wsId, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 1000,
    }),
    prisma.issue.findMany({
      where: { workspaceId: wsId, createdAt: { gte: months[0].from } },
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  const sCounts = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const open = (sCounts.get("OPEN") ?? 0) + (sCounts.get("IN_PROGRESS") ?? 0) + (sCounts.get("REOPENED") ?? 0);

  let mttrHours = 0;
  if (resolvedRows.length > 0) {
    const totalMs = resolvedRows.reduce(
      (acc, r) => acc + (r.resolvedAt!.getTime() - r.createdAt.getTime()),
      0,
    );
    mttrHours = Math.round(totalMs / resolvedRows.length / (1000 * 60 * 60));
  }

  const created = bucketByMonth(recent.map((r) => ({ createdAt: r.createdAt })), months);
  const resolved = bucketByMonth(
    recent.filter((r) => r.resolvedAt).map((r) => ({ createdAt: r.resolvedAt! })),
    months,
  );

  const projName = new Map(projects.map((p) => [p.id, `${p.key} · ${p.name}`]));
  const projectSeries = byProject
    .map((b) => ({ label: projName.get(b.projectId) ?? "Unknown", value: b._count._all }))
    .sort((a, b) => b.value - a.value);

  const pCounts = new Map(byPriority.map((b) => [b.priority, b._count._all]));
  const sevCounts = new Map(bySeverity.map((b) => [b.severity, b._count._all]));
  const tCounts = new Map(byType.map((b) => [b.type, b._count._all]));

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Issues & bugs analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Total issues" value={total.toLocaleString()} />
        <StatCard title="Open" value={open.toLocaleString()} />
        <StatCard title="Resolved" value={(sCounts.get("RESOLVED") ?? 0).toLocaleString()} />
        <StatCard title="Mean time to resolve" value={`${mttrHours}h`} hint={`${resolvedRows.length} sample`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title="Created (last 12 months)" points={created} />
        <LineChart title="Resolved (last 12 months)" points={resolved} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="By status" series={STATUSES.map((s) => ({ label: s, value: sCounts.get(s) ?? 0 }))} />
        <BarList title="By priority" series={PRIORITIES.map((p) => ({ label: p, value: pCounts.get(p) ?? 0 }))} />
        <BarList title="By severity" series={SEVERITIES.map((s) => ({ label: s, value: sevCounts.get(s) ?? 0 }))} />
        <BarList title="By type" series={TYPES.map((t) => ({ label: t, value: tCounts.get(t) ?? 0 }))} />
      </div>

      <BarList title="Open issues by project" series={projectSeries.slice(0, 12)} emptyHint="No open issues." />
    </div>
  );
}
