import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import {
  approvalStatusColor,
  decodeApprovers,
  formatApprovalStatus,
  isApprover,
  type ApprovalStatus,
} from "@/modules/approvals/schemas";
import {
  approveApprovalRequestAction,
  cancelApprovalRequestAction,
  rejectApprovalRequestAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "view");
  const { id } = await params;

  const req = await prisma.approvalRequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      policy: true,
      decisions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!req) notFound();

  const approverIds = req.policy ? decodeApprovers(req.policy.approverIds) : [];
  const userIsApprover =
    approverIds.length === 0 || isApprover(approverIds, ctx.userId);
  const isPending = req.status === "PENDING";
  const isRequester = req.requesterId === ctx.userId;
  const status = req.status as ApprovalStatus;

  const approveBound = approveApprovalRequestAction.bind(null, req.id);
  const rejectBound = rejectApprovalRequestAction.bind(null, req.id);
  const cancelBound = cancelApprovalRequestAction.bind(null, req.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${approvalStatusColor(status)}`}
        >
          {formatApprovalStatus(status)}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          {req.resource} · {req.resourceId}
        </h1>
      </div>

      <Card className="space-y-2 p-4 text-sm">
        <div>Requester: {req.requesterId}</div>
        <div>Policy: {req.policy?.name ?? "none"}</div>
        {req.amount != null ? (
          <div>Amount: {Number(req.amount).toFixed(2)}</div>
        ) : null}
        {req.reason ? (
          <div className="whitespace-pre-wrap">Reason: {req.reason}</div>
        ) : null}
        {req.decidedAt ? (
          <div className="text-xs text-muted-foreground">
            Decided {req.decidedAt.toISOString().slice(0, 10)} by{" "}
            {req.decidedById ?? "—"}
            {req.decisionNote ? ` — ${req.decisionNote}` : ""}
          </div>
        ) : null}
      </Card>

      {isPending && userIsApprover ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Decide</h2>
          <form action={approveBound} className="grid gap-2">
            <Label htmlFor="anote">Approval note (optional)</Label>
            <Textarea id="anote" name="note" rows={2} maxLength={500} />
            <Button type="submit" size="sm">
              Approve
            </Button>
          </form>
          <form action={rejectBound} className="grid gap-2 border-t pt-3">
            <Label htmlFor="rnote">Rejection reason</Label>
            <Textarea id="rnote" name="note" rows={2} maxLength={500} />
            <Button type="submit" size="sm" variant="ghost">
              Reject
            </Button>
          </form>
        </Card>
      ) : null}

      {isPending && isRequester ? (
        <form action={cancelBound}>
          <Button type="submit" size="sm" variant="outline">
            Cancel my request
          </Button>
        </form>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Decision history</h2>
        {req.decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {req.decisions.map((d) => (
              <li key={d.id} className="py-2">
                <span className="font-medium">{d.decision}</span> by{" "}
                {d.approverId} ·{" "}
                <span className="text-xs text-muted-foreground">
                  {d.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                {d.note ? (
                  <div className="mt-1 whitespace-pre-wrap text-xs">
                    {d.note}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <Link
          href="/app/approvals"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to approvals
        </Link>
      </div>
    </div>
  );
}
