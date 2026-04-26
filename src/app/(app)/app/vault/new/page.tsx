import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VAULT_ITEM_TYPE_LABELS, VAULT_ITEM_TYPES } from "@/modules/vault/schemas";
import { createVaultItemAction } from "../actions";
import { SecretField } from "../secret-field";

export default async function NewVaultItemPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "create");
  const folders = await prisma.vaultFolder.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">New vault item</h1>
      <Card className="p-6">
        <form action={createVaultItemAction} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue="LOGIN">
                {VAULT_ITEM_TYPES.map((t) => <option key={t} value={t}>{VAULT_ITEM_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="folderId">Folder</Label>
              <Select id="folderId" name="folderId" defaultValue="">
                <option value="">— None —</option>
                {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={200} autoFocus />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="username">Username / email</Label>
              <Input id="username" name="username" maxLength={200} autoComplete="off" />
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" maxLength={500} placeholder="https://..." />
            </div>
          </div>
          <SecretField label="Password / secret" />
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={1000} />
          </div>
          <Button type="submit">Create item</Button>
        </form>
      </Card>
    </div>
  );
}
