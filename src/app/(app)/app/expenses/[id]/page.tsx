import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import {
  approveExpenseAction,
  deleteExpenseAction,
  rejectExpenseAction,
  reimburseExpenseAction,
  submitExpenseAction,
  updateExpenseAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  REIMBURSED: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const exp = await prisma.expense.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!exp) return notFound();

  const [submitter, approver, categories] = await Promise.all([
    prisma.user.findUnique({ where: { id: exp.submittedById }, select: { id: true, name: true, email: true } }),
    exp.approvedById
      ? prisma.user.findUnique({ where: { id: exp.approvedById }, select: { id: true, name: true, email: true } })
      : Promise.resolve(null),
    prisma.expenseCategory.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const isSelf = exp.submittedById === ctx.userId;
  const isApprover = can(ctx.role, "expense", "manage");
  const editable = (exp.status === "DRAFT" || exp.status === "REJECTED") &&
    (isSelf || isApprover) && can(ctx.role, "expense", "edit");
  const canSubmit = (exp.status === "DRAFT" || exp.status === "REJECTED") && isSelf;
  const canApprove = exp.status === "SUBMITTED" && isApprover;
  const canReimburse = exp.status === "APPROVED" && isApprover;
  const canDelete = (exp.status === "DRAFT" || exp.status === "REJECTED") &&
    can(ctx.role, "expense", "delete") && (isSelf || isApprover);

  const update = updateExpenseAction.bind(null, exp.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/app/expenses" className="text-xs text-muted-foreground hover:underline">
            ← Expenses
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{exp.merchant}</h1>
          <p className="text-sm text-muted-foreground">
            {exp.expenseDate.toISOString().slice(0, 10)} · {exp.currency} {Number(exp.amount).toFixed(2)}
            {Number(exp.taxAmount) > 0 ? ` (incl. tax ${Number(exp.taxAmount).toFixed(2)})` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={"rounded px-2 py-0.5 text-xs font-medium uppercase " + (statusColor[exp.status] ?? "")}>
            {exp.status}
          </span>
          <div className="flex gap-2">
            {canSubmit ? (
              <form action={submitExpenseAction.bind(null, exp.id)}>
                <Button type="submit" size="sm">Submit for approval</Button>
              </form>
            ) : null}
            {canApprove ? (
              <form action={approveExpenseAction.bind(null, exp.id)}>
                <Button type="submit" size="sm">Approve</Button>
              </form>
            ) : null}
            {canReimburse ? (
              <form action={reimburseExpenseAction.bind(null, exp.id)}>
                <Button type="submit" size="sm">Mark reimbursed</Button>
              </form>
            ) : null}
            {canDelete ? (
              <form action={deleteExpenseAction.bind(null, exp.id)}>
                <Button type="submit" size="sm" variant="destructive">Delete</Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 text-sm md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Submitted by</div>
          <div className="mt-1 font-medium">{submitter?.name ?? submitter?.email ?? "—"}</div>
          {exp.submittedAt ? (
            <div className="text-xs text-muted-foreground">
              on {exp.submittedAt.toISOString().slice(0, 16).replace("T", " ")}
            </div>
          ) : null}
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Decision</div>
          <div className="mt-1 font-medium">
            {approver ? (approver.name ?? approver.email) : "—"}
          </div>
          {exp.decidedAt ? (
            <div className="text-xs text-muted-foreground">
              {exp.status} on {exp.decidedAt.toISOString().slice(0, 16).replace("T", " ")}
            </div>
          ) : null}
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Reimbursed</div>
          <div className="mt-1 font-medium">
            {exp.reimbursedAt ? exp.reimbursedAt.toISOString().slice(0, 10) : "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {exp.reimbursable ? "Reimbursable" : "Not reimbursable"}
          </div>
        </Card>
      </div>

      {exp.status === "REJECTED" && exp.rejectionReason ? (
        <Card className="border-rose-300 bg-rose-50 p-4 text-sm dark:bg-rose-950/40 dark:border-rose-900">
          <div className="font-semibold text-rose-700 dark:text-rose-200">Rejection reason</div>
          <p className="mt-1 whitespace-pre-wrap">{exp.rejectionReason}</p>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">{editable ? "Edit expense" : "Expense details"}</h2>
        <form action={update} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="expenseDate">Date</Label>
            <Input id="expenseDate" name="expenseDate" type="date" required disabled={!editable}
              defaultValue={exp.expenseDate.toISOString().slice(0, 10)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="merchant">Merchant</Label>
            <Input id="merchant" name="merchant" required disabled={!editable} defaultValue={exp.merchant} />
          </div>
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" name="categoryId" defaultValue={exp.categoryId ?? ""} disabled={!editable}>
              <option value="">(none)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required disabled={!editable}
              defaultValue={Number(exp.amount).toFixed(2)} />
          </div>
          <div>
            <Label htmlFor="taxAmount">Tax</Label>
            <Input id="taxAmount" name="taxAmount" type="number" step="0.01" min="0" disabled={!editable}
              defaultValue={Number(exp.taxAmount).toFixed(2)} />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" maxLength={3} disabled={!editable} defaultValue={exp.currency} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="reimbursable" name="reimbursable" defaultChecked={exp.reimbursable} disabled={!editable} />
            <Label htmlFor="reimbursable" className="text-sm">Reimbursable</Label>
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="receiptUrl">Receipt URL</Label>
            <Input id="receiptUrl" name="receiptUrl" type="url" disabled={!editable} defaultValue={exp.receiptUrl ?? ""} />
            {exp.receiptUrl ? (
              <a href={exp.receiptUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                View receipt →
              </a>
            ) : null}
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} disabled={!editable} defaultValue={exp.description ?? ""} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} disabled={!editable} defaultValue={exp.notes ?? ""} />
          </div>
          {editable ? (
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">Save changes</Button>
            </div>
          ) : null}
        </form>
      </Card>

      {canApprove ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Reject this expense</h2>
          <form action={rejectExpenseAction.bind(null, exp.id)} className="space-y-3">
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={2} placeholder="Optional explanation for the submitter" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="destructive">Reject</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
