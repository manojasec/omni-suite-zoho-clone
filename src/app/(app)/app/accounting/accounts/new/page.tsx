import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LEDGER_ACCOUNT_TYPES } from "@/modules/accounting/schemas";
import { createLedgerAccountAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "create");
  const parents = await prisma.ledgerAccount.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });

  return (
    <div className="space-y-4">
      <Link href="/app/accounting/accounts" className="text-sm text-muted-foreground hover:underline">← Chart of accounts</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New account</h1>
      <Card className="p-6">
        <form action={createLedgerAccountAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required maxLength={20} placeholder="1010" />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" required>
                {LEDGER_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="Cash on hand" />
          </div>
          <div>
            <Label htmlFor="parentId">Parent (optional)</Label>
            <Select id="parentId" name="parentId" defaultValue="">
              <option value="">— None —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name} ({p.type})</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/accounting/accounts"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
