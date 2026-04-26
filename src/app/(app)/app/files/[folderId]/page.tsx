import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder as FolderIcon, FileText, Star, Trash2 } from "lucide-react";
import { formatBytes, fileIconKind } from "@/modules/files/schemas";
import {
  createFileAction,
  createFolderAction,
  deleteFolderAction,
  renameFolderAction,
  toggleStarFileAction,
  trashFileAction,
} from "../actions";

export const dynamic = "force-dynamic";

async function loadAncestors(workspaceId: string, folderId: string): Promise<{ id: string; name: string }[]> {
  const trail: { id: string; name: string }[] = [];
  let current: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId },
    select: { id: true, name: true, parentId: true },
  });
  if (!current) return trail;
  trail.unshift({ id: current.id, name: current.name });
  while (current?.parentId) {
    const parent: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findFirst({
      where: { id: current.parentId, workspaceId },
      select: { id: true, name: true, parentId: true },
    });
    if (!parent) break;
    trail.unshift({ id: parent.id, name: parent.name });
    current = parent;
  }
  return trail;
}

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "view");
  const { folderId } = await params;

  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId: ctx.workspaceId },
  });
  if (!folder) notFound();

  const [subfolders, files, ancestors] = await Promise.all([
    prisma.folder.findMany({
      where: { workspaceId: ctx.workspaceId, parentId: folderId },
      orderBy: { name: "asc" },
    }),
    prisma.fileAsset.findMany({
      where: { workspaceId: ctx.workspaceId, folderId, trashedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    loadAncestors(ctx.workspaceId, folderId),
  ]);

  const canCreate = can(ctx.role, "folder", "create");
  const canUpload = can(ctx.role, "fileAsset", "create");
  const canEdit = can(ctx.role, "folder", "edit");
  const canDelete = can(ctx.role, "folder", "delete");

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/app/files" className="hover:underline">Files</Link>
        {ancestors.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <span>/</span>
            {a.id === folderId ? (
              <span className="font-medium text-foreground">{a.name}</span>
            ) : (
              <Link href={`/app/files/${a.id}`} className="hover:underline">{a.name}</Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{folder.name}</h1>
          {folder.description ? <p className="text-sm text-muted-foreground">{folder.description}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link href="/app/files/starred"><Button variant="outline" size="sm"><Star className="h-3.5 w-3.5 mr-1" />Starred</Button></Link>
          <Link href="/app/files/trash"><Button variant="outline" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" />Trash</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {canCreate ? (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">New folder</h2>
            <form action={createFolderAction} className="space-y-2">
              <input type="hidden" name="parentId" value={folderId} />
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required maxLength={160} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" maxLength={500} />
              </div>
              <div className="flex justify-end"><Button type="submit" size="sm">Create</Button></div>
            </form>
          </Card>
        ) : null}
        {canUpload ? (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Register file</h2>
            <form action={createFileAction} className="space-y-2">
              <input type="hidden" name="folderId" value={folderId} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required maxLength={260} />
                </div>
                <div>
                  <Label htmlFor="mimeType">MIME</Label>
                  <Input id="mimeType" name="mimeType" defaultValue="application/octet-stream" />
                </div>
                <div>
                  <Label htmlFor="sizeBytes">Size (bytes)</Label>
                  <Input id="sizeBytes" name="sizeBytes" type="number" min={0} defaultValue={0} />
                </div>
                <div>
                  <Label htmlFor="storageKey">Storage key / URL</Label>
                  <Input id="storageKey" name="storageKey" required maxLength={500} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} maxLength={500} />
              </div>
              <div className="flex justify-end"><Button type="submit" size="sm">Register</Button></div>
            </form>
          </Card>
        ) : null}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">Contents ({subfolders.length + files.length})</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1 text-left">Name</th>
              <th className="px-3 py-1 text-left">Type</th>
              <th className="px-3 py-1 text-right">Size</th>
              <th className="px-3 py-1 text-left">Updated</th>
              <th className="px-3 py-1" />
            </tr>
          </thead>
          <tbody>
            {subfolders.map((f) => (
              <tr key={f.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link href={`/app/files/${f.id}`} className="flex items-center gap-2 hover:underline">
                    <FolderIcon className="h-4 w-4 text-amber-600" />
                    <span>{f.name}</span>
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">Folder</td>
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">{f.updatedAt.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">
                  {canDelete ? (
                    <form action={deleteFolderAction.bind(null, f.id)}>
                      <Button type="submit" size="sm" variant="ghost">Delete</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {files.map((f) => (
              <tr key={f.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{f.name}</span>
                    {f.starred ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fileIconKind(f.mimeType)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatBytes(f.sizeBytes)}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.updatedAt.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  {canEdit ? (
                    <form action={toggleStarFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">{f.starred ? "Unstar" : "Star"}</Button>
                    </form>
                  ) : null}
                  {can(ctx.role, "fileAsset", "delete") ? (
                    <form action={trashFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">Trash</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {subfolders.length === 0 && files.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">This folder is empty.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {canEdit ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Rename folder</h2>
          <form action={renameFolderAction.bind(null, folder.id)} className="flex gap-2">
            <Input name="name" defaultValue={folder.name} required maxLength={160} className="flex-1" />
            <Button type="submit" size="sm">Save</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
