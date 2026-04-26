import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  PAY_ITEM_KIND_LABELS,
  PAY_ITEM_KINDS,
  PAY_RUN_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/modules/payroll/schemas";
import { addPayItemAction, deletePayItemAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function PaySlipDetailPage({
  params,
}: {
  params: Promise<{ id: string; slipId: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "paySlip", "view");
  const { id: payRunId, slipId } = await params;

  const slip = await prisma.paySlip.findFirst({
    where: { id: slipId, payRunId, payRun: { workspaceId: ctx.workspaceId } },
    include: {
      payRun: true,
      employee: { select: { firstName: true, lastName: true, email: true, jobTitle: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!slip) notFound();

  const isDraft = slip.payRun.status === "DRAFT";
  const canEdit = can(ctx.role, "paySlip", "edit");

  const addItem = addPayItemAction.bind(null, slip.id);

  return (
    <div className="space-y-3">
      <div>
        <Link
          href={`/app/hr/payroll/${slip.payRunId}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to {slip.payRun.label}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {slip.employee.firstName} {slip.employee.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {slip.employee.email}
          {slip.employee.jobTitle ? ` · ${slip.employee.jobTitle}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Pay run {PAY_RUN_STATUS_LABELS[slip.payRun.status]} · pay date{" "}
          {formatDate(slip.payRun.payDate)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Gross</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(slip.gross), slip.payRun.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Deductions</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(slip.deductions), slip.payRun.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Tax</p>
          <p className="text-lg font-semibold">
            {formatMoney(Number(slip.tax), slip.payRun.currency)}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Net</p>
          <p className="text-lg font-semibold text-emerald-700">
            {formatMoney(Number(slip.net), slip.payRun.currency)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-medium">Line items</h2>
        {slip.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Kind</th>
                  <th className="py-1">Label</th>
                  <th className="py-1 text-right">Amount</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {slip.items.map((item) => {
                  const removeItem = deletePayItemAction.bind(null, item.id);
                  return (
                    <tr key={item.id}>
                      <td className="py-2">{PAY_ITEM_KIND_LABELS[item.kind]}</td>
                      <td className="py-2">{item.label}</td>
                      <td className="py-2 text-right">
                        {formatMoney(Number(item.amount), slip.payRun.currency)}
                      </td>
                      <td className="py-2 text-right">
                        {canEdit && isDraft ? (
                          <form action={removeItem}>
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

        {canEdit && isDraft ? (
          <form
            action={addItem}
            className="mt-3 grid grid-cols-1 items-end gap-2 border-t pt-3 sm:grid-cols-[140px_1fr_140px_auto]"
          >
            <div className="space-y-1">
              <Label htmlFor="kind">Kind</Label>
              <Select id="kind" name="kind" required defaultValue="EARNING">
                {PAY_ITEM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {PAY_ITEM_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                name="label"
                required
                maxLength={120}
                placeholder="Bonus / 401k / Medicare"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min={0} required />
            </div>
            <Button type="submit">Add</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
