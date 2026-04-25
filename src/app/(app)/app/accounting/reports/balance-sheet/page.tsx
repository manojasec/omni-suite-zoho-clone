import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BalanceSheetPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "view");
  const wsId = ctx.workspaceId;
  const [accounts, lines, ws] = await Promise.all([
    prisma.ledgerAccount.findMany({ where: { workspaceId: wsId }, orderBy: [{ type: "asc" }, { code: "asc" }] }),
    prisma.journalLine.findMany({
      where: { workspaceId: wsId, entry: { status: "POSTED" } },
      select: { accountId: true, debit: true, credit: true },
    }),
    prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } }),
  ]);
  const currency = ws?.currency ?? "USD";
  const balances = new Map<string, number>();
  for (const l of lines) {
    const acc = accounts.find((a) => a.id === l.accountId);
    if (!acc) continue;
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    const debitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
    const bal = debitNormal ? debit - credit : credit - debit;
    balances.set(l.accountId, (balances.get(l.accountId) ?? 0) + bal);
  }
  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");
  const equity = accounts.filter((a) => a.type === "EQUITY");
  const totalAssets = assets.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const totalEquity = equity.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const retained = accounts
    .filter((a) => a.type === "INCOME" || a.type === "EXPENSE")
    .reduce((s, a) => {
      const bal = balances.get(a.id) ?? 0;
      return s + (a.type === "INCOME" ? bal : -bal);
    }, 0);
  const totalLiabEquity = totalLiabilities + totalEquity + retained;

  function Section({ title, list }: { title: string; list: typeof accounts }) {
    const total = list.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
    return (
      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">{title}</div>
        <table className="w-full text-sm">
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 font-mono w-24">{a.code}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(balances.get(a.id) ?? 0, currency)}</td>
              </tr>
            ))}
            {list.length === 0 ? <tr><td colSpan={3} className="px-3 py-3 text-center text-xs text-muted-foreground">None</td></tr> : null}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Total {title}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(total, currency)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/reports" className="text-xs text-muted-foreground hover:underline">← Reports</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Balance sheet</h1>
      <Section title="Assets" list={assets} />
      <Section title="Liabilities" list={liabilities} />
      <Section title="Equity" list={equity} />
      <Card className="p-4 space-y-1 text-sm">
        <div className="flex justify-between"><span>Retained earnings (posted P&amp;L)</span><span className="tabular-nums">{formatCurrency(retained, currency)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total liabilities + equity</span><span className="tabular-nums">{formatCurrency(totalLiabEquity, currency)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total assets</span><span className="tabular-nums">{formatCurrency(totalAssets, currency)}</span></div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Difference</span><span className="tabular-nums">{formatCurrency(totalAssets - totalLiabEquity, currency)}</span></div>
      </Card>
    </div>
  );
}
