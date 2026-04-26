import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "view");
  const dashboards = await prisma.dashboard.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { widgets: true } } },
  });
  const canCreate = can(ctx.role, "dashboard", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/reports" className="text-xs text-muted-foreground hover:underline">← Reports</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custom dashboards</h1>
          <p className="text-sm text-muted-foreground">Build your own pivots and KPIs over workspace data.</p>
        </div>
        {canCreate ? <Link href="/app/reports/dashboards/new"><Button>New dashboard</Button></Link> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((d) => (
          <Link key={d.id} href={`/app/reports/dashboards/${d.id}`}>
            <Card className="cursor-pointer p-4 transition hover:border-primary">
              <h2 className="text-base font-semibold">{d.name}</h2>
              {d.description ? <p className="mt-1 text-xs text-muted-foreground">{d.description}</p> : null}
              <p className="mt-3 text-xs text-muted-foreground">{d._count.widgets} widget{d._count.widgets === 1 ? "" : "s"}</p>
            </Card>
          </Link>
        ))}
        {dashboards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dashboards yet. {canCreate ? "Create your first." : null}</p>
        ) : null}
      </div>
    </div>
  );
}
