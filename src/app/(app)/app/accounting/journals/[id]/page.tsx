import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  deleteJournalEntryAction,
  postJournalEntryAction,
  voidJournalEntryAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "view");
  const { id } = await params;
  const [entry, ws] = await Promise.all([
    prisma.journalEntry.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        lines: {
          orderBy: { position: "asc" },
          include: { account: { select: { code: true, name: true, type: true } } },
        },
      },
    }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
  ]);
  if (!entry) notFound();
  const currency = ws?.currency ?? "USD";
  const debitSum = entry.lines.reduce((acc, l) => acc + Number(l.debit), 0);
  const creditSum = entry.lines.reduce((acc, l) => acc + Number(l.credit), 0);

  const canManage = can(ctx.role, "journalEntry", "manage");
  const canDelete = can(ctx.role, "journalEntry", "delete");

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/journals" className="text-xs text-muted-foreground hover:underline">← Journal entries</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{entry.reference}</h1>
        <span className={
          entry.status === "POSTED" ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" :
          entry.status === "VOID" ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200" :
          "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        }>{entry.status}</span>
        <span className="text-sm text-muted-foreground">{entry.date.toISOString().slice(0, 10)}</span>
      </div>
      {entry.memo ? <p className="text-sm text-muted-foreground">{entry.memo}</p> : null}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono">{l.account.code} · {l.account.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.description ?? ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit), currency) : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit), currency) : ""}</td>
              </tr>
            ))}
            <tr className="border-t bg-muted/40 font-semibold">
              <td className="px-3 py-2" colSpan={2}>Totals</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(debitSum, currency)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(creditSum, currency)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canManage && entry.status === "DRAFT" ? (
          <form action={postJournalEntryAction.bind(null, entry.id)}>
            <Button type="submit">Post entry</Button>
          </form>
        ) : null}
        {canManage && entry.status === "POSTED" ? (
          <form action={voidJournalEntryAction.bind(null, entry.id)}>
            <Button type="submit" variant="outline">Void entry</Button>
          </form>
        ) : null}
        {canDelete && entry.status !== "POSTED" ? (
          <form action={deleteJournalEntryAction.bind(null, entry.id)}>
            <Button type="submit" variant="destructive">Delete</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
