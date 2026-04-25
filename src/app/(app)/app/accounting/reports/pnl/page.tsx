import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfitLossPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "view");
  const wsId = ctx.workspaceId;
  const [accounts, lines, ws] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { workspaceId: wsId, type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: [{ type: "asc" }, { code: "asc" }],
    }),
    prisma.journalLine.findMany({
      where: { workspaceId: wsId, entry: { status: "POSTED" }, account: { type: { in: ["INCOME", "EXPENSE"] } } },
      select: { accountId: true, debit: true, credit: true },
    }),
    prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } }),
  ]);
  const currency = ws?.currency ?? "USD";
  const tot = new Map<string, number>();
  for (const l of lines) {
    const acc = accounts.find((a) => a.id === l.accountId);
    if (!acc) continue;
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    const bal = acc.type === "INCOME" ? credit - debit : debit - credit;
    tot.set(l.accountId, (tot.get(l.accountId) ?? 0) + bal);
  }
  const income = accounts.filter((a) => a.type === "INCOME");
  const expense = accounts.filter((a) => a.type === "EXPENSE");
  const totalIncome = income.reduce((acc, a) => acc + (tot.get(a.id) ?? 0), 0);
  const totalExpense = expense.reduce((acc, a) => acc + (tot.get(a.id) ?? 0), 0);
  const net = totalIncome - totalExpense;

  function Section({ title, list, total }: { title: string; list: typeof accounts; total: number }) {
    return (
      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">{title}</div>
        <table className="w-full text-sm">
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 font-mono w-24">{a.code}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(tot.get(a.id) ?? 0, currency)}</td>
              </tr>
            ))}
            {list.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-3 text-center text-xs text-muted-foreground">None</td></tr>
            ) : null}
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
      <h1 className="text-2xl font-semibold tracking-tight">Profit &amp; loss</h1>
      <Section title="Income" list={income} total={totalIncome} />
      <Section title="Expenses" list={expense} total={totalExpense} />
      <Card className="p-4">
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Net income</span>
          <span className={`tabular-nums ${net < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {formatCurrency(net, currency)}
          </span>
        </div>
      </Card>
    </div>
  );
}
