import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { archiveLedgerAccountAction } from "../actions";

export const dynamic = "force-dynamic";

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;

export default async function AccountsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "view");
  const accounts = await prisma.ledgerAccount.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  const canCreate = can(ctx.role, "ledgerAccount", "create");
  const canEdit = can(ctx.role, "ledgerAccount", "edit");
  const canDelete = can(ctx.role, "ledgerAccount", "delete");

  const grouped = new Map<string, typeof accounts>();
  for (const t of TYPE_ORDER) grouped.set(t, []);
  for (const a of accounts) grouped.get(a.type)?.push(a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/accounting" className="text-xs text-muted-foreground hover:underline">← Accounting</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of accounts</h1>
        </div>
        {canCreate ? (
          <Link href="/app/accounting/accounts/new"><Button>New account</Button></Link>
        ) : null}
      </div>

      {TYPE_ORDER.map((type) => {
        const list = grouped.get(type) ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={type} className="p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{type}</h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left font-medium py-1 w-24">Code</th><th className="text-left font-medium py-1">Name</th><th className="text-right font-medium py-1 w-32">Status</th><th className="w-32" /></tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2 font-mono">{a.code}</td>
                    <td className="py-2">{a.name}{a.description ? <div className="text-xs text-muted-foreground">{a.description}</div> : null}</td>
                    <td className="py-2 text-right text-xs">
                      {a.archived ? <span className="rounded bg-muted px-2 py-0.5">Archived</span> : <span className="text-muted-foreground">Active</span>}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit ? <Link href={`/app/accounting/accounts/${a.id}`}><Button size="sm" variant="ghost">Edit</Button></Link> : null}
                        {canDelete ? (
                          <form action={archiveLedgerAccountAction.bind(null, a.id)}>
                            <Button type="submit" size="sm" variant="outline">{a.archived ? "Restore" : "Archive"}</Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}

      {accounts.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No accounts yet. Start by creating asset/liability/equity/income/expense accounts.
        </Card>
      ) : null}
    </div>
  );
}
