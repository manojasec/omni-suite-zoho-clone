import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VAULT_ITEM_TYPE_LABELS, VAULT_ITEM_TYPES } from "@/modules/vault/schemas";
import {
  updateVaultItemAction,
  deleteVaultItemAction,
  toggleFavoriteVaultItemAction,
} from "../actions";
import { SecretField } from "../secret-field";
import { RevealSecret } from "../reveal-secret";

export default async function VaultItemPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "view");
  const { id } = await params;
  const item = await prisma.vaultItem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      folder: true,
      createdBy: { select: { name: true, email: true } },
      accesses: {
        orderBy: { at: "desc" },
        take: 25,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!item) notFound();

  const folders = await prisma.vaultFolder.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
  });

  const canEdit = can(ctx.role, "vaultItem", "edit");
  const canDelete = can(ctx.role, "vaultItem", "delete");

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {VAULT_ITEM_TYPE_LABELS[item.type]} · {item.folder?.name ?? "No folder"} · Created by {item.createdBy?.name ?? item.createdBy?.email ?? "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <form action={toggleFavoriteVaultItemAction.bind(null, item.id)}>
              <Button type="submit" variant="outline" size="sm">{item.favorite ? "★ Favorited" : "☆ Favorite"}</Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteVaultItemAction.bind(null, item.id)}>
              <Button type="submit" variant="outline" size="sm" className="text-red-600">Delete</Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Username</Label>
            <p className="text-sm">{item.username ?? "—"}</p>
          </div>
          <div>
            <Label>URL</Label>
            <p className="text-sm break-all">
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">{item.url}</a> : "—"}
            </p>
          </div>
        </div>
        <div>
          <Label>Secret</Label>
          <RevealSecret itemId={item.id} />
        </div>
        {item.notes ? (
          <div>
            <Label>Notes</Label>
            <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
          </div>
        ) : null}
      </Card>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-3">Edit item</h2>
          <form action={updateVaultItemAction.bind(null, item.id)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue={item.type}>
                  {VAULT_ITEM_TYPES.map((t) => <option key={t} value={t}>{VAULT_ITEM_TYPE_LABELS[t]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="folderId">Folder</Label>
                <Select id="folderId" name="folderId" defaultValue={item.folderId ?? ""}>
                  <option value="">— None —</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={item.name} required maxLength={200} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" defaultValue={item.username ?? ""} maxLength={200} />
              </div>
              <div>
                <Label htmlFor="url">URL</Label>
                <Input id="url" name="url" defaultValue={item.url ?? ""} maxLength={500} />
              </div>
            </div>
            <SecretField name="secret" label="New secret" optional />
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={item.notes ?? ""} rows={3} maxLength={1000} />
            </div>
            <Button type="submit" variant="outline">Save changes</Button>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold">Access log</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {item.accesses.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 text-muted-foreground">{a.at.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="px-3 py-2">{a.user?.name ?? a.user?.email ?? "—"}</td>
                <td className="px-3 py-2">{a.action}</td>
              </tr>
            ))}
            {item.accesses.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">No access events yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
