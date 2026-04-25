import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ReportsHubPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "view");
  const tiles = [
    { href: "/app/accounting/reports/trial-balance", title: "Trial balance", desc: "All accounts with debit/credit totals from posted entries." },
    { href: "/app/accounting/reports/pnl", title: "Profit & loss", desc: "Income minus expenses for the workspace." },
    { href: "/app/accounting/reports/balance-sheet", title: "Balance sheet", desc: "Assets, liabilities, and equity at a snapshot." },
  ];
  return (
    <div className="space-y-4">
      <Link href="/app/accounting" className="text-xs text-muted-foreground hover:underline">← Accounting</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Financial reports</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="p-4 hover:bg-accent">
              <div className="font-semibold">{t.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{t.desc}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
