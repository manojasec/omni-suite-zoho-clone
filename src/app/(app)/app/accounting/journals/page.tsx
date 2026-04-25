import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "view");

  const [entries, ws] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { lines: { select: { debit: true, credit: true } } },
    }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
  ]);
  const currency = ws?.currency ?? "USD";
  const canCreate = can(ctx.role, "journalEntry", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/accounting" className="text-xs text-muted-foreground hover:underline">← Accounting</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Journal entries</h1>
        </div>
        {canCreate ? <Link href="/app/accounting/journals/new"><Button>New entry</Button></Link> : null}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Memo</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const total = e.lines.reduce((acc, l) => acc + Number(l.debit), 0);
              return (
                <tr key={e.id} className="border-t hover:bg-accent">
                  <td className="px-3 py-2 font-mono">
                    <Link href={`/app/accounting/journals/${e.id}`} className="hover:underline">{e.reference}</Link>
                  </td>
                  <td className="px-3 py-2">{e.date.toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.memo ?? ""}</td>
                  <td className="px-3 py-2">
                    <span className={
                      e.status === "POSTED" ? "rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" :
                      e.status === "VOID" ? "rounded bg-rose-100 px-2 py-0.5 text-rose-800 dark:bg-rose-950 dark:text-rose-200" :
                      "rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    }>{e.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(total, currency)}</td>
                </tr>
              );
            })}
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No entries yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
