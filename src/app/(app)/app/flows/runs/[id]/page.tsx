import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  FLOW_APPROVAL_DECISION_LABELS,
  FLOW_NODE_KIND_LABELS,
  FLOW_RUN_STATUS_LABELS,
  FLOW_STEP_STATUS_LABELS,
  formatDate,
  formatRelativeDuration,
  nextNodes,
} from "@/modules/flows/schemas";
import {
  advanceRunAction,
  cancelRunAction,
  decideApprovalAction,
  deleteRunAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-700",
  RUNNING: "bg-sky-100 text-sky-700",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELED: "bg-zinc-200 text-zinc-600",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "view");

  const run = await prisma.flowRun.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      flow: {
        include: {
          nodes: { select: { id: true, key: true, kind: true, label: true } },
          edges: {
            select: { fromKey: true, toKey: true, branch: true },
          },
        },
      },
      steps: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!run) notFound();

  const canManageRun = can(ctx.role, "flowRun", "manage");
  const canApprove = can(ctx.role, "flowApproval", "manage");
  const canDelete = can(ctx.role, "flowRun", "delete");

  const advanceBound = advanceRunAction.bind(null, run.id);
  const cancelBound = cancelRunAction.bind(null, run.id);
  const deleteBound = deleteRunAction.bind(null, run.id);

  const possibleNext = run.currentNodeKey
    ? nextNodes(run.flow.edges, run.currentNodeKey)
    : [];
  const nextNodeOptions = run.flow.nodes.filter((n) =>
    possibleNext.includes(n.key),
  );

  const pendingApproval = run.steps.find(
    (s) => s.kind === "APPROVAL" && s.approvalDecision === "PENDING",
  );

  const ms =
    (run.finishedAt ?? new Date()).getTime() - run.startedAt.getTime();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <Link href={`/app/flows/${run.flow.id}`} className="hover:underline">
              {run.flow.name}
            </Link>{" "}
            run
          </h1>
          <p className="text-sm text-muted-foreground">
            Started {formatDate(run.startedAt)} · {formatRelativeDuration(ms)}
            {run.currentNodeKey ? (
              <>
                {" "}
                · current <code>{run.currentNodeKey}</code>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={
            "rounded px-2 py-0.5 text-xs font-medium " +
            (statusColor[run.status] ?? "bg-zinc-100 text-zinc-700")
          }
        >
          {FLOW_RUN_STATUS_LABELS[run.status]}
        </span>
      </div>

      {run.error ? (
        <Card className="border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {run.error}
        </Card>
      ) : null}

      {pendingApproval && canApprove ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Approval required: <code>{pendingApproval.nodeKey}</code>
          </h2>
          <form
            action={decideApprovalAction.bind(null, pendingApproval.id)}
            className="grid gap-2"
          >
            <div>
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea id="comment" name="comment" rows={2} maxLength={500} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                name="decision"
                value="APPROVED"
                size="sm"
              >
                Approve
              </Button>
              <Button
                type="submit"
                name="decision"
                value="REJECTED"
                size="sm"
                variant="outline"
              >
                Reject
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {canManageRun &&
      run.status === "RUNNING" &&
      nextNodeOptions.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Advance run</h2>
          <form action={advanceBound} className="grid gap-2 md:grid-cols-3">
            <div>
              <Label htmlFor="nodeKey">Next node</Label>
              <Select id="nodeKey" name="nodeKey" required>
                {nextNodeOptions.map((n) => (
                  <option key={n.id} value={n.key}>
                    {n.label} ({FLOW_NODE_KIND_LABELS[n.kind]})
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="note">Note</Label>
              <Input id="note" name="note" maxLength={500} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">
                Advance
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Step history</h2>
          <div className="flex gap-2">
            {canManageRun &&
            (run.status === "RUNNING" ||
              run.status === "AWAITING_APPROVAL" ||
              run.status === "PENDING") ? (
              <form action={cancelBound}>
                <Button type="submit" size="sm" variant="outline">
                  Cancel run
                </Button>
              </form>
            ) : null}
            {canDelete &&
            (run.status === "COMPLETED" ||
              run.status === "FAILED" ||
              run.status === "CANCELED") ? (
              <form action={deleteBound}>
                <Button type="submit" size="sm" variant="outline">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
        </div>
        {run.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps recorded.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {run.steps.map((s, idx) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {idx + 1}. <code>{s.nodeKey}</code>{" "}
                    <span className="text-muted-foreground">
                      ({FLOW_NODE_KIND_LABELS[s.kind]})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(s.startedAt)}
                    {s.finishedAt ? (
                      <>
                        {" "}
                        · finished {formatDate(s.finishedAt)} ·{" "}
                        {formatRelativeDuration(
                          s.finishedAt.getTime() - s.startedAt.getTime(),
                        )}
                      </>
                    ) : null}
                  </div>
                  {s.note ? (
                    <div className="mt-1 text-xs">
                      <strong>Note:</strong> {s.note}
                    </div>
                  ) : null}
                  {s.kind === "APPROVAL" && s.approvalDecision ? (
                    <div className="mt-1 text-xs">
                      <strong>Decision:</strong>{" "}
                      {FLOW_APPROVAL_DECISION_LABELS[s.approvalDecision]}
                      {s.comment ? ` — ${s.comment}` : ""}
                    </div>
                  ) : null}
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">
                  {FLOW_STEP_STATUS_LABELS[s.status]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
