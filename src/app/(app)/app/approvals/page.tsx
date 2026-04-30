import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  APPROVAL_STATUSES,
  approvalStatusColor,
  formatApprovalStatus,
  type ApprovalStatus,
} from "@/modules/approvals/schemas";

export const dynamic = "force-dynamic";

export default async function ApprovalsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "view");
  const canCreate = can(ctx.role, "approval", "create");
  const canManage = can(ctx.role, "approval", "manage");

  const sp = await searchParams;
  const status =
    sp.status && (APPROVAL_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as ApprovalStatus)
      : undefined;

  const requests = await prisma.approvalRequest.findMany({
    where: { workspaceId: ctx.workspaceId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { policy: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and decide pending approval requests across the workspace.
          </p>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <Link href="/app/approvals/policies">
              <Button variant="outline">Policies</Button>
            </Link>
          ) : null}
          {canCreate ? (
            <Link href="/app/approvals/new">
              <Button>New request</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/app/approvals"
          className={`rounded border px-2 py-1 ${!status ? "bg-accent" : "hover:bg-accent/50"}`}
        >
          All
        </Link>
        {APPROVAL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/approvals?status=${s}`}
            className={`rounded border px-2 py-1 ${status === s ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            {formatApprovalStatus(s)}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No approval requests.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/app/approvals/${r.id}`}
              className="block p-4 hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${approvalStatusColor(r.status as ApprovalStatus)}`}
                >
                  {formatApprovalStatus(r.status as ApprovalStatus)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {r.resource} · {r.resourceId}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.policy?.name ?? "no policy"} · requested{" "}
                    {r.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                {r.amount != null ? (
                  <div className="text-sm font-semibold">
                    {Number(r.amount).toFixed(2)}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
