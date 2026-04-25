import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createBankTransactionAction, toggleReconcileAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BankAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bankAccount", "view");
  const { id } = await params;
  const bank = await prisma.bankAccount.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      ledgerAccount: { select: { code: true, name: true } },
      transactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!bank) notFound();

  const balance = bank.transactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const reconciled = bank.transactions.filter((t) => t.status === "RECONCILED").reduce((a, t) => a + Number(t.amount), 0);
  const canCreate = can(ctx.role, "bankTransaction", "create");
  const canManage = can(ctx.role, "bankTransaction", "manage");

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/banks" className="text-xs text-muted-foreground hover:underline">← Bank accounts</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{bank.name}</h1>
        <p className="text-sm text-muted-foreground">
          {bank.bankName ?? ""}{bank.accountNumberLast4 ? ` · ····${bank.accountNumberLast4}` : ""} ·
          Linked to {bank.ledgerAccount.code} {bank.ledgerAccount.name}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Balance</div><div className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(balance, bank.currency)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Reconciled</div><div className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(reconciled, bank.currency)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Transactions</div><div className="mt-1 text-xl font-semibold">{bank.transactions.length}</div></Card>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Add transaction</h2>
          <form action={createBankTransactionAction.bind(null, bank.id)} className="grid gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required placeholder="-100.00" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" maxLength={100} />
            </div>
            <div className="flex items-end justify-end"><Button type="submit">Add</Button></div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Use negative amounts for outflows.</p>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {bank.transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">{t.date.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">{t.description}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.reference ?? ""}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${Number(t.amount) < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {formatCurrency(Number(t.amount), bank.currency)}
                </td>
                <td className="px-3 py-2 text-right">
                  {canManage ? (
                    <form action={toggleReconcileAction.bind(null, t.id)}>
                      <Button type="submit" size="sm" variant={t.status === "RECONCILED" ? "outline" : "default"}>
                        {t.status === "RECONCILED" ? "Unreconcile" : "Reconcile"}
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {bank.transactions.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No transactions yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
