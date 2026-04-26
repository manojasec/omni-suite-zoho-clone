import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatDate, formatRelativeDuration } from "@/modules/flows/schemas";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowApproval", "view");

  const pending = await prisma.flowRunStep.findMany({
    where: {
      kind: "APPROVAL",
      approvalDecision: "PENDING",
      run: { workspaceId: ctx.workspaceId },
    },
    include: {
      run: {
        include: { flow: { select: { id: true, name: true } } },
      },
    },
    orderBy: { startedAt: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Pending approvals across all flow runs.
          </p>
        </div>
        <Link
          href="/app/flows"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to Command Center
        </Link>
      </div>

      <Card className="p-4">
        <div className="text-xs text-muted-foreground">Pending</div>
        <div className="mt-1 text-2xl font-semibold">{pending.length}</div>
      </Card>

      {pending.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No approvals pending.
        </Card>
      ) : (
        <Card className="divide-y">
          {pending.map((s) => {
            const ms = Date.now() - s.startedAt.getTime();
            return (
              <Link
                key={s.id}
                href={`/app/flows/runs/${s.run.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {s.run.flow.name} · <code>{s.nodeKey}</code>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Awaiting since {formatDate(s.startedAt)} · pending{" "}
                    {formatRelativeDuration(ms)}
                  </div>
                </div>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Pending
                </span>
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
