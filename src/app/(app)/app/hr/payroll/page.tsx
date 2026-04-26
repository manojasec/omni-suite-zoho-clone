import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PAY_RUN_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/modules/payroll/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-rose-100 text-rose-700",
};

export default async function PayrollListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "view");

  const runs = await prisma.payRun.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { payDate: "desc" },
    include: { _count: { select: { slips: true } } },
  });
  const canCreate = can(ctx.role, "payRun", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Pay runs, employee pay slips, and tax/deduction line items.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/hr/payroll/new">
            <Button>New pay run</Button>
          </Link>
        ) : null}
      </div>

      {runs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No pay runs yet — create your first run to begin.
        </Card>
      ) : (
        <Card className="divide-y">
          {runs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/hr/payroll/${r.id}`}
                  className="font-medium hover:underline"
                >
                  {r.label}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.periodStart)} → {formatDate(r.periodEnd)} · pay date{" "}
                  {formatDate(r.payDate)} · {r._count.slips} slips
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {formatMoney(Number(r.totalNet), r.currency)} net
                </span>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[r.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {PAY_RUN_STATUS_LABELS[r.status]}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
