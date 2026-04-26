import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  PAY_RUN_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/modules/payroll/schemas";
import {
  addEmployeeToPayRunAction,
  approvePayRunAction,
  cancelPayRunAction,
  deletePayRunAction,
  markPayRunPaidAction,
  removeSlipAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-rose-100 text-rose-700",
};

export default async function PayRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "view");
  const { id } = await params;

  const run = await prisma.payRun.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      slips: {
        include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!run) notFound();

  const enrolledEmployeeIds = new Set(run.slips.map((s) => s.employeeId));
  const employees = await prisma.employee.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: "ACTIVE",
      id: { notIn: Array.from(enrolledEmployeeIds) },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const isDraft = run.status === "DRAFT";
  const canManage = can(ctx.role, "payRun", "manage");
  const canDelete = can(ctx.role, "payRun", "delete");
  const canEditSlips = can(ctx.role, "paySlip", "create");
  const canDeleteSlip = can(ctx.role, "paySlip", "delete");

  const approve = approvePayRunAction.bind(null, run.id);
  const markPaid = markPayRunPaidAction.bind(null, run.id);
  const cancel = cancelPayRunAction.bind(null, run.id);
  const del = deletePayRunAction.bind(null, run.id);
  const addEmp = addEmployeeToPayRunAction.bind(null, run.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            <span
              className={
                "rounded px-2 py-0.5 text-xs font-medium " +
                (statusColor[run.status] ?? "bg-zinc-100 text-zinc-700")
              }
            >
              {PAY_RUN_STATUS_LABELS[run.status]}
            </span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{run.label}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(run.periodStart)} → {formatDate(run.periodEnd)} · pay date{" "}
            {formatDate(run.payDate)} · {run.currency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && isDraft ? (
            <form action={approve}>
              <Button type="submit">Approve</Button>
            </form>
          ) : null}
          {canManage && run.status === "APPROVED" ? (
            <form action={markPaid}>
              <Button type="submit">Mark paid</Button>
            </form>
          ) : null}
          {canManage && run.status !== "PAID" && run.status !== "CANCELED" ? (
            <form action={cancel}>
              <Button type="submit" variant="outline">
                Cancel
              </Button>
            </form>
          ) : null}
          {canDelete && run.status !== "PAID" ? (
            <form action={del}>
              <Button type="submit" variant="outline" className="text-rose-600">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Gross</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(run.totalGross), run.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Deductions</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(run.totalDeductions), run.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Tax</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(run.totalTax), run.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Net</p>
          <p className="text-lg font-semibold text-emerald-700">
            {formatMoney(Number(run.totalNet), run.currency)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-medium">Pay slips</h2>
        {run.slips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No employees on this run yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Employee</th>
                  <th className="py-1 text-right">Gross</th>
                  <th className="py-1 text-right">Deductions</th>
                  <th className="py-1 text-right">Tax</th>
                  <th className="py-1 text-right">Net</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {run.slips.map((slip) => {
                  const removeAction = removeSlipAction.bind(null, slip.id);
                  return (
                    <tr key={slip.id}>
                      <td className="py-2">
                        <Link
                          href={`/app/hr/payroll/${run.id}/slips/${slip.id}`}
                          className="font-medium hover:underline"
                        >
                          {slip.employee.firstName} {slip.employee.lastName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{slip.employee.email}</p>
                      </td>
                      <td className="py-2 text-right">
                        {formatMoney(Number(slip.gross), run.currency)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatMoney(Number(slip.deductions), run.currency)}
                      </td>
                      <td className="py-2 text-right text-muted-foreground">
                        {formatMoney(Number(slip.tax), run.currency)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatMoney(Number(slip.net), run.currency)}
                      </td>
                      <td className="py-2 text-right">
                        {canDeleteSlip && isDraft ? (
                          <form action={removeAction}>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              className="text-rose-600"
                            >
                              Remove
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canEditSlips && isDraft ? (
          <form action={addEmp} className="mt-3 grid grid-cols-1 items-end gap-2 border-t pt-3 sm:grid-cols-[1fr_140px_auto]">
            <div className="space-y-1">
              <Label htmlFor="employeeId">Add employee</Label>
              <Select id="employeeId" name="employeeId" required defaultValue="">
                <option value="" disabled>
                  Select an active employee…
                </option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseSalary">Base salary</Label>
              <Input
                id="baseSalary"
                name="baseSalary"
                type="number"
                step="0.01"
                min={0}
                required
                placeholder="5000.00"
              />
            </div>
            <Button type="submit" disabled={employees.length === 0}>
              Add to run
            </Button>
          </form>
        ) : null}
      </Card>

      {run.notes ? (
        <Card className="p-4">
          <h2 className="text-sm font-medium">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{run.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
