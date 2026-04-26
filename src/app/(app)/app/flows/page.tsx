import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FLOW_STATUS_LABELS,
  FLOW_TRIGGER_LABELS,
  formatDate,
} from "@/modules/flows/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function FlowsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "view");

  const flows = await prisma.flow.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { nodes: true, edges: true, runs: true } },
    },
  });

  const counts = {
    DRAFT: flows.filter((f) => f.status === "DRAFT").length,
    ACTIVE: flows.filter((f) => f.status === "ACTIVE").length,
    PAUSED: flows.filter((f) => f.status === "PAUSED").length,
    ARCHIVED: flows.filter((f) => f.status === "ARCHIVED").length,
  };
  const canCreate = can(ctx.role, "flow", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Visual workflow orchestrator with branching, approvals, and webhooks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/flows/runs">
            <Button variant="outline">Runs</Button>
          </Link>
          <Link href="/app/flows/approvals">
            <Button variant="outline">Approvals</Button>
          </Link>
          {canCreate ? (
            <Link href="/app/flows/new">
              <Button>New flow</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="mt-1 text-2xl font-semibold">{counts.ACTIVE}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Draft</div>
          <div className="mt-1 text-2xl font-semibold">{counts.DRAFT}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Paused</div>
          <div className="mt-1 text-2xl font-semibold">{counts.PAUSED}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Archived</div>
          <div className="mt-1 text-2xl font-semibold">{counts.ARCHIVED}</div>
        </Card>
      </div>

      {flows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No flows yet. Create one to start orchestrating tasks and approvals.
        </Card>
      ) : (
        <Card className="divide-y">
          {flows.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/flows/${f.id}`}
                  className="font-medium hover:underline"
                >
                  {f.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {FLOW_TRIGGER_LABELS[f.trigger]} · {f._count.nodes} nodes ·{" "}
                  {f._count.edges} edges · {f._count.runs} run
                  {f._count.runs === 1 ? "" : "s"} · updated {formatDate(f.updatedAt)}
                </p>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[f.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {FLOW_STATUS_LABELS[f.status]}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
