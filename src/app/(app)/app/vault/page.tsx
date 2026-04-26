import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VAULT_ITEM_TYPE_LABELS, VAULT_ITEM_TYPES } from "@/modules/vault/schemas";
import { createVaultFolderAction, deleteVaultFolderAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VaultListPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; type?: string; q?: string; favorite?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "vaultItem", "view");
  const sp = await searchParams;
  const folderId = sp.folder && sp.folder !== "all" ? sp.folder : undefined;
  const typeFilter = sp.type && sp.type !== "all" ? (sp.type as (typeof VAULT_ITEM_TYPES)[number]) : undefined;
  const favoriteOnly = sp.favorite === "1";
  const q = (sp.q ?? "").trim();

  const [folders, items] = await Promise.all([
    prisma.vaultFolder.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.vaultItem.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(folderId ? { folderId } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(favoriteOnly ? { favorite: true } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { username: { contains: q } }, { url: { contains: q } }] } : {}),
      },
      orderBy: [{ favorite: "desc" }, { updatedAt: "desc" }],
      include: { folder: true },
      take: 200,
    }),
  ]);

  const canCreateItem = can(ctx.role, "vaultItem", "create");
  const canCreateFolder = can(ctx.role, "vaultFolder", "create");
  const canDeleteFolder = can(ctx.role, "vaultFolder", "delete");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Vault</h1>
        {canCreateItem ? (
          <Link href="/app/vault/new"><Button>New item</Button></Link>
        ) : null}
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-5">
          <div>
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Name, username, URL..." />
          </div>
          <div>
            <Label htmlFor="folder">Folder</Label>
            <Select id="folder" name="folder" defaultValue={folderId ?? "all"}>
              <option value="all">All folders</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue={typeFilter ?? "all"}>
              <option value="all">All types</option>
              {VAULT_ITEM_TYPES.map((t) => <option key={t} value={t}>{VAULT_ITEM_TYPE_LABELS[t]}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="favorite">Favorites</Label>
            <Select id="favorite" name="favorite" defaultValue={favoriteOnly ? "1" : "0"}>
              <option value="0">All</option>
              <option value="1">Favorites only</option>
            </Select>
          </div>
          <div className="flex items-end"><Button type="submit" variant="outline">Apply</Button></div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="p-4 h-fit">
          <h2 className="text-sm font-semibold mb-3">Folders</h2>
          <ul className="space-y-1">
            {folders.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/vault?folder=${f.id}`} className="text-sm hover:underline">{f.name}</Link>
                {canDeleteFolder ? (
                  <form action={deleteVaultFolderAction.bind(null, f.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">×</button>
                  </form>
                ) : null}
              </li>
            ))}
            {folders.length === 0 ? <li className="text-xs text-muted-foreground">No folders yet.</li> : null}
          </ul>
          {canCreateFolder ? (
            <form action={createVaultFolderAction} className="mt-4 space-y-2 border-t pt-3">
              <Input name="name" placeholder="New folder" required maxLength={160} />
              <Button type="submit" size="sm" variant="outline" className="w-full">Add folder</Button>
            </form>
          ) : null}
        </Card>

        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Folder</th>
                <th className="px-3 py-2 text-right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/app/vault/${it.id}`} className="font-medium hover:underline">
                      {it.favorite ? "★ " : ""}{it.name}
                    </Link>
                    {it.url ? <p className="text-xs text-muted-foreground">{it.url}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{VAULT_ITEM_TYPE_LABELS[it.type]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{it.username ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{it.folder?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{it.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No items match your filters.</td></tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
