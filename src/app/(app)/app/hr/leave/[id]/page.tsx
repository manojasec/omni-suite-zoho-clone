import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import {
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
  cancelLeaveRequestAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function LeaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const lr = await prisma.leaveRequest.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true, email: true } },
      leaveType: { select: { name: true, paid: true } },
    },
  });
  if (!lr) notFound();

  const isApprover = can(ctx.role, "leaveRequest", "manage");
  const canApprove = isApprover && lr.status === "PENDING";
  const canCancel =
    can(ctx.role, "leaveRequest", "edit") &&
    (lr.status === "PENDING" || lr.status === "APPROVED");

  let approvedBy: { name: string | null; email: string } | null = null;
  if (lr.approvedById) {
    approvedBy = await prisma.user.findUnique({
      where: { id: lr.approvedById },
      select: { name: true, email: true },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/app/hr/leave" className="hover:underline">Leave requests</Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lr.employee.firstName} {lr.employee.lastName} · {lr.leaveType.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lr.startDate.toISOString().slice(0, 10)} → {lr.endDate.toISOString().slice(0, 10)}
            {" · "}{Number(lr.days).toFixed(2)} day(s)
            {" · "}{lr.leaveType.paid ? "Paid" : "Unpaid"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{lr.status}</span>
          {canApprove ? (
            <form action={approveLeaveRequestAction.bind(null, lr.id)}>
              <Button type="submit" size="sm">Approve</Button>
            </form>
          ) : null}
          {canCancel ? (
            <form action={cancelLeaveRequestAction.bind(null, lr.id)}>
              <Button type="submit" size="sm" variant="ghost">Cancel</Button>
            </form>
          ) : null}
        </div>
      </div>

      {lr.status === "REJECTED" && lr.rejectionReason ? (
        <Card className="p-4 border-rose-200 bg-rose-50 dark:bg-rose-950/40">
          <div className="text-xs font-semibold text-rose-700 dark:text-rose-200">Rejected</div>
          <p className="text-sm">{lr.rejectionReason}</p>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <dl className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Employee</dt>
            <dd>{lr.employee.firstName} {lr.employee.lastName} ({lr.employee.employeeNumber})</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{lr.employee.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Leave type</dt>
            <dd>{lr.leaveType.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="tabular-nums">{lr.createdAt.toISOString().slice(0, 16).replace("T", " ")}</dd>
          </div>
          {lr.decidedAt ? (
            <div>
              <dt className="text-muted-foreground">Decided</dt>
              <dd className="tabular-nums">{lr.decidedAt.toISOString().slice(0, 16).replace("T", " ")}</dd>
            </div>
          ) : null}
          {approvedBy ? (
            <div>
              <dt className="text-muted-foreground">Decided by</dt>
              <dd>{approvedBy.name ?? approvedBy.email}</dd>
            </div>
          ) : null}
          {lr.reason ? (
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Reason</dt>
              <dd className="whitespace-pre-wrap">{lr.reason}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {canApprove ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Reject this request</h2>
          <form action={rejectLeaveRequestAction.bind(null, lr.id)} className="space-y-3">
            <Textarea name="reason" rows={3} placeholder="Reason for rejection (required)" required />
            <Button type="submit" variant="destructive" size="sm">Reject request</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
