import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  FLOW_RUN_STATUSES,
  FLOW_RUN_STATUS_LABELS,
  formatDate,
  formatRelativeDuration,
  summarizeRuns,
} from "@/modules/flows/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-700",
  RUNNING: "bg-sky-100 text-sky-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELED: "bg-zinc-200 text-zinc-600",
};

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "view");

  const status =
    sp.status && FLOW_RUN_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof FLOW_RUN_STATUSES)[number])
      : undefined;

  const runs = await prisma.flowRun.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
    },
    include: { flow: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const allRuns = await prisma.flowRun.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { status: true },
  });
  const summary = summarizeRuns(allRuns);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flow runs</h1>
          <p className="text-sm text-muted-foreground">
            Execution history across all flows in this workspace.
          </p>
        </div>
        <Link
          href="/app/flows"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Command Center
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Running</div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.byStatus.RUNNING}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Awaiting approval</div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.awaitingApproval}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Completed</div>
          <div className="mt-1 text-2xl font-semibold">
            {summary.byStatus.COMPLETED}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/flows/runs"
          className={
            "rounded px-2 py-1 " +
            (!status ? "bg-foreground text-background" : "bg-muted hover:bg-accent")
          }
        >
          All
        </Link>
        {FLOW_RUN_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/flows/runs?status=${s}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {FLOW_RUN_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {runs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No runs match this filter.
        </Card>
      ) : (
        <Card className="divide-y">
          {runs.map((r) => {
            const ms =
              (r.finishedAt ?? new Date()).getTime() - r.startedAt.getTime();
            return (
              <Link
                key={r.id}
                href={`/app/flows/runs/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{r.flow.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(r.startedAt)} ·{" "}
                    {r.currentNodeKey ? (
                      <>
                        @ <code>{r.currentNodeKey}</code> ·{" "}
                      </>
                    ) : null}
                    {formatRelativeDuration(ms)}
                  </div>
                </div>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[r.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {FLOW_RUN_STATUS_LABELS[r.status]}
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
