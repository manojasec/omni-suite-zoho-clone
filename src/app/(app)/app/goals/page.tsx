import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GOAL_STATUSES,
  formatGoalStatus,
  goalStatusColor,
  type GoalStatus,
} from "@/modules/goals/schemas";

export const dynamic = "force-dynamic";

export default async function GoalsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "view");
  const canCreate = can(ctx.role, "goal", "create");

  const sp = await searchParams;
  const status =
    sp.status && (GOAL_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as GoalStatus)
      : undefined;

  const goals = await prisma.goal.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      status: true,
      progress: true,
      dueDate: true,
      parentId: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goals & OKRs</h1>
          <p className="text-sm text-muted-foreground">
            Track objectives and measurable key results across the workspace.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/goals/new">
            <Button>New goal</Button>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/app/goals"
          className={`rounded border px-2 py-1 ${!status ? "bg-accent" : "hover:bg-accent/50"}`}
        >
          All
        </Link>
        {GOAL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/goals?status=${s}`}
            className={`rounded border px-2 py-1 ${status === s ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            {formatGoalStatus(s)}
          </Link>
        ))}
      </div>

      {goals.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No goals yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {goals.map((g) => {
            const pct = Math.max(0, Math.min(100, Number(g.progress)));
            return (
              <Link
                key={g.id}
                href={`/app/goals/${g.id}`}
                className="block p-4 hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${goalStatusColor(g.status as GoalStatus)}`}
                  >
                    {formatGoalStatus(g.status as GoalStatus)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{g.title}</div>
                    {g.dueDate ? (
                      <p className="text-xs text-muted-foreground">
                        due {g.dueDate.toISOString().slice(0, 10)}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-40 shrink-0">
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs text-muted-foreground">
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
