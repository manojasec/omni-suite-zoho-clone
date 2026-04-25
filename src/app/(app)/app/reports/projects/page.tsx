import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"] as const;

export default async function ProjectsAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const [byProjectStatus, byTaskStatus, overdueTasks, totalProjects] = await Promise.all([
    prisma.project.groupBy({
      by: ["status"],
      where: { workspaceId: wsId },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { workspaceId: wsId },
      _count: { _all: true },
    }),
    prisma.task.count({
      where: {
        workspaceId: wsId,
        status: { notIn: ["DONE", "CANCELLED"] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.project.count({ where: { workspaceId: wsId } }),
  ]);

  const ps = new Map(byProjectStatus.map((b) => [b.status, b._count._all]));
  const ts = new Map(byTaskStatus.map((b) => [b.status, b._count._all]));

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Projects analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Active projects" value={(ps.get("ACTIVE") ?? 0).toLocaleString()} />
        <StatCard title="Completed" value={(ps.get("COMPLETED") ?? 0).toLocaleString()} />
        <StatCard title="Tasks done" value={(ts.get("DONE") ?? 0).toLocaleString()} />
        <StatCard title="Overdue tasks" value={overdueTasks.toLocaleString()} hint={`of ${totalProjects} projects`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Projects by status"
          series={PROJECT_STATUSES.map((s) => ({ label: s, value: ps.get(s) ?? 0 }))}
        />
        <BarList
          title="Tasks by status"
          series={TASK_STATUSES.map((s) => ({ label: s, value: ts.get(s) ?? 0 }))}
        />
      </div>
    </div>
  );
}
