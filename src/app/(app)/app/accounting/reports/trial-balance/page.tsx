import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage() {
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
  const tot = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const cur = tot.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit);
    cur.credit += Number(l.credit);
    tot.set(l.accountId, cur);
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const rows = accounts.map((a) => {
    const t = tot.get(a.id) ?? { debit: 0, credit: 0 };
    const debitNormal = a.type === "ASSET" || a.type === "EXPENSE";
    const net = t.debit - t.credit;
    let dispDebit = 0;
    let dispCredit = 0;
    if (debitNormal) {
      if (net >= 0) dispDebit = net; else dispCredit = -net;
    } else {
      if (net <= 0) dispCredit = -net; else dispDebit = net;
    }
    totalDebit += dispDebit;
    totalCredit += dispCredit;
    return { account: a, dispDebit, dispCredit };
  });

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/reports" className="text-xs text-muted-foreground hover:underline">← Reports</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Trial balance</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account.id} className="border-t">
                <td className="px-3 py-2 font-mono">{r.account.code}</td>
                <td className="px-3 py-2">{r.account.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.account.type}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dispDebit > 0 ? formatCurrency(r.dispDebit, currency) : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.dispCredit > 0 ? formatCurrency(r.dispCredit, currency) : ""}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-3 py-2" colSpan={3}>Totals</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalDebit, currency)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totalCredit, currency)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Difference: {formatCurrency(totalDebit - totalCredit, currency)} (should be 0 if all entries balance).
      </p>
    </div>
  );
}
