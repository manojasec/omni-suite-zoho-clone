import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CHANGE_RISK_LABELS,
  CHANGE_STATUS_LABELS,
} from "@/modules/itsm/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELED: "bg-zinc-200 text-zinc-700",
};

const riskColor: Record<string, string> = {
  LOW: "text-emerald-700",
  MEDIUM: "text-amber-700",
  HIGH: "text-rose-700",
};

export default async function ChangesListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "view");

  const changes = await prisma.change.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { number: "desc" },
    include: { asset: { select: { tag: true, name: true } } },
  });
  const canCreate = can(ctx.role, "change", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Changes</h1>
          <p className="text-sm text-muted-foreground">
            Change requests with approval workflow and rollback plans.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/itsm/changes/new">
            <Button>New change</Button>
          </Link>
        ) : null}
      </div>

      {changes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No changes yet — raise the first change request.
        </Card>
      ) : (
        <Card className="divide-y">
          {changes.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/itsm/changes/${c.id}`}
                  className="font-medium hover:underline"
                >
                  CHG-{c.number}: {c.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {c.asset ? `[${c.asset.tag}] ${c.asset.name}` : "No asset linked"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className={"text-xs font-medium " + (riskColor[c.risk] ?? "")}>
                  {CHANGE_RISK_LABELS[c.risk]} risk
                </span>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[c.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {CHANGE_STATUS_LABELS[c.status]}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
