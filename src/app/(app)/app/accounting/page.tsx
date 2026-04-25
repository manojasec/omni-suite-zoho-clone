import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { aggregateLines, normalBalance } from "@/modules/accounting/schemas";

export const dynamic = "force-dynamic";

export default async function AccountingHubPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "view");
  const wsId = ctx.workspaceId;

  const [accounts, postedLines, draftCount, journalCount, bankCount, ws] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { workspaceId: wsId },
      select: { id: true, type: true },
    }),
    prisma.journalLine.findMany({
      where: { workspaceId: wsId, entry: { status: "POSTED" } },
      select: { accountId: true, debit: true, credit: true },
    }),
    prisma.journalEntry.count({ where: { workspaceId: wsId, status: "DRAFT" } }),
    prisma.journalEntry.count({ where: { workspaceId: wsId } }),
    prisma.bankAccount.count({ where: { workspaceId: wsId } }),
    prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } }),
  ]);

  const currency = ws?.currency ?? "USD";
  const accountType = new Map(accounts.map((a) => [a.id, a.type]));
  const totals = aggregateLines(
    postedLines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) })),
  );

  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let income = 0;
  let expense = 0;
  for (const [accountId, agg] of totals) {
    const type = accountType.get(accountId);
    if (!type) continue;
    const bal = normalBalance({ accountId, type, debit: agg.debit, credit: agg.credit });
    if (type === "ASSET") assets += bal;
    else if (type === "LIABILITY") liabilities += bal;
    else if (type === "EQUITY") equity += bal;
    else if (type === "INCOME") income += bal;
    else if (type === "EXPENSE") expense += bal;
  }
  const netIncome = income - expense;

  const tiles = [
    { href: "/app/accounting/accounts", title: "Chart of accounts", value: `${accounts.length} accounts` },
    { href: "/app/accounting/journals", title: "Journal entries", value: `${journalCount} total · ${draftCount} draft` },
    { href: "/app/accounting/banks", title: "Bank accounts", value: `${bankCount} accounts` },
    { href: "/app/accounting/reports", title: "Financial statements", value: "Trial balance · P&L · Balance sheet" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
        <p className="text-sm text-muted-foreground">
          Double-entry general ledger, journal posting, bank reconciliation, and financial statements.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total assets</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(assets, currency)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Total liabilities</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(liabilities, currency)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Equity</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(equity, currency)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground">Net income (posted)</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatCurrency(netIncome, currency)}</div></Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-md border bg-card p-4 transition hover:bg-accent">
            <div className="text-sm font-semibold">{t.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t.value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
