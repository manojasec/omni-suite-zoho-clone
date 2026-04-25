import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { createBankAccountAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "bankAccount", "view");

  const [banks, assetAccounts, ws] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        ledgerAccount: { select: { code: true, name: true } },
        transactions: { select: { amount: true, status: true } },
      },
    }),
    prisma.ledgerAccount.findMany({
      where: { workspaceId: ctx.workspaceId, type: "ASSET", archived: false, bankAccount: null },
      orderBy: [{ code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
  ]);
  const currency = ws?.currency ?? "USD";
  const canCreate = can(ctx.role, "bankAccount", "create");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/accounting" className="text-xs text-muted-foreground hover:underline">← Accounting</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Bank accounts</h1>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Bank</th>
              <th className="px-3 py-2 text-left">Ledger</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">Unreconciled</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b) => {
              const balance = b.transactions.reduce((acc, t) => acc + Number(t.amount), 0);
              const unreconciled = b.transactions.filter((t) => t.status === "UNRECONCILED").length;
              return (
                <tr key={b.id} className="border-t hover:bg-accent">
                  <td className="px-3 py-2">
                    <Link href={`/app/accounting/banks/${b.id}`} className="font-medium hover:underline">{b.name}</Link>
                    {b.accountNumberLast4 ? <div className="text-xs text-muted-foreground">····{b.accountNumberLast4}</div> : null}
                  </td>
                  <td className="px-3 py-2">{b.bankName ?? ""}</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.ledgerAccount.code} · {b.ledgerAccount.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(balance, b.currency || currency)}</td>
                  <td className="px-3 py-2 text-right">{unreconciled}</td>
                </tr>
              );
            })}
            {banks.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No bank accounts yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Add bank account</h2>
          {assetAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create an unlinked asset account in the chart of accounts first (e.g. &ldquo;1010 Cash at Bank&rdquo;).
            </p>
          ) : (
            <form action={createBankAccountAction} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="ledgerAccountId">Linked ledger account</Label>
                  <Select id="ledgerAccountId" name="ledgerAccountId" required defaultValue="">
                    <option value="">— Pick asset account —</option>
                    {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Display name</Label>
                  <Input id="name" name="name" required maxLength={120} placeholder="Operating · Chase 9876" />
                </div>
                <div>
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input id="bankName" name="bankName" maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="accountNumberLast4">Last 4 digits</Label>
                  <Input id="accountNumberLast4" name="accountNumberLast4" maxLength={4} />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input id="currency" name="currency" maxLength={3} defaultValue={currency} />
                </div>
              </div>
              <div className="flex justify-end"><Button type="submit">Create</Button></div>
            </form>
          )}
        </Card>
      ) : null}
    </div>
  );
}
