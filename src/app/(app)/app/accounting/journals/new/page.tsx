import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createJournalEntryAction } from "../../actions";

export const dynamic = "force-dynamic";

const LINE_COUNT = 8;

export default async function NewJournalEntryPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "create");
  const accounts = await prisma.ledgerAccount.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });

  if (accounts.length < 2) {
    return (
      <div className="space-y-4">
        <Link href="/app/accounting/journals" className="text-sm text-muted-foreground hover:underline">← Journal entries</Link>
        <Card className="p-6">
          <h1 className="text-lg font-semibold">Add at least two accounts first</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Double-entry requires accounts to debit and credit. Visit the chart of accounts to add some.
          </p>
          <div className="mt-4">
            <Link href="/app/accounting/accounts/new"><Button>Create account</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/journals" className="text-sm text-muted-foreground hover:underline">← Journal entries</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New journal entry</h1>
      <Card className="p-6">
        <form action={createJournalEntryAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" required maxLength={50} placeholder="JE-001" />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label htmlFor="memo">Memo</Label>
              <Input id="memo" name="memo" maxLength={500} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-1 w-1/3">Account</th>
                  <th className="text-left py-1">Description</th>
                  <th className="text-right py-1 w-32">Debit</th>
                  <th className="text-right py-1 w-32">Credit</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: LINE_COUNT }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1 pr-2">
                      <Select name="accountId" defaultValue="">
                        <option value="">— Pick account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} · {a.name} ({a.type})</option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-1 pr-2">
                      <Input name="lineDescription" maxLength={200} />
                    </td>
                    <td className="py-1 pr-2">
                      <Input name="debit" type="number" step="0.01" min="0" defaultValue="0" className="text-right" />
                    </td>
                    <td className="py-1">
                      <Input name="credit" type="number" step="0.01" min="0" defaultValue="0" className="text-right" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              Leave unused rows blank. Total debits must equal total credits to save.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/app/accounting/journals"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Save as draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
