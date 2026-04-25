import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { createExpenseAction } from "./actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  REIMBURSED: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const status = params.status?.toUpperCase();
  const mine = params.mine === "1";

  const isApprover = ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "MANAGER" || ctx.role === "FINANCE";

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"].includes(status)
      ? { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED" }
      : {}),
    // Non-approvers only see their own expenses
    ...(!isApprover || mine ? { submittedById: ctx.userId } : {}),
  };

  const [expenses, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      take: 200,
    }),
    prisma.expenseCategory.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const submitterIds = [...new Set(expenses.map((e) => e.submittedById))];
  const users = submitterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: submitterIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const canCreate = can(ctx.role, "expense", "create");

  // Summary tiles
  const totals = await prisma.expense.groupBy({
    by: ["status"],
    where: { workspaceId: ctx.workspaceId, ...(!isApprover ? { submittedById: ctx.userId } : {}) },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const tile = (s: string) => totals.find((t) => t.status === s);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track, submit, and reimburse business expenses.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/expenses/categories" className="text-sm text-muted-foreground hover:underline self-center">
            Categories →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(["DRAFT", "SUBMITTED", "APPROVED", "REIMBURSED"] as const).map((s) => {
          const t = tile(s);
          return (
            <Card key={s} className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{s}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {Number(t?._sum.amount ?? 0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">{t?._count._all ?? 0} expenses</div>
            </Card>
          );
        })}
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New expense</h2>
          <form action={createExpenseAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="expenseDate">Date *</Label>
              <Input id="expenseDate" name="expenseDate" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="merchant">Merchant *</Label>
              <Input id="merchant" name="merchant" required placeholder="Delta Airlines" />
            </div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue="">
                <option value="">(none)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="taxAmount">Tax</Label>
              <Input id="taxAmount" name="taxAmount" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="reimbursable" name="reimbursable" defaultChecked />
              <Label htmlFor="reimbursable" className="text-sm">Reimbursable</Label>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="receiptUrl">Receipt URL</Label>
              <Input id="receiptUrl" name="receiptUrl" type="url" placeholder="https://…" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">Save as draft</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex gap-2 text-xs">
        <Link href="/app/expenses" className={"rounded px-2 py-1 " + (!status && !mine ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50")}>All</Link>
        {(["SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED", "DRAFT"] as const).map((s) => (
          <Link key={s} href={`/app/expenses?status=${s.toLowerCase()}`}
            className={"rounded px-2 py-1 " + (status === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50")}>
            {s}
          </Link>
        ))}
        {isApprover ? (
          <Link href="/app/expenses?mine=1"
            className={"rounded px-2 py-1 " + (mine ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50")}>
            My expenses
          </Link>
        ) : null}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Merchant</th>
                <th className="px-4 py-2 text-left">Submitted by</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No expenses found.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => {
                  const submitter = userById.get(e.submittedById);
                  return (
                    <tr key={e.id} className="border-b">
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">
                        {e.expenseDate.toISOString().slice(0, 10)}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/app/expenses/${e.id}`} className="font-medium hover:underline">
                          {e.merchant}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {submitter?.name ?? submitter?.email ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{e.category?.name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " + (statusColor[e.status] ?? "")}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {e.currency} {Number(e.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/app/expenses/${e.id}`} className="text-xs text-primary hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
