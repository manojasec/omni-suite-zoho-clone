import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  deleteNoteAction,
  toggleArchiveNoteAction,
  togglePinNoteAction,
  updateNoteAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "view");
  const { id } = await params;
  const [note, notebooks] = await Promise.all([
    prisma.note.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { notebook: true },
    }),
    prisma.notebook.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
  ]);
  if (!note) notFound();
  const canEdit = can(ctx.role, "note", "edit");
  const canDelete = can(ctx.role, "note", "delete");

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/app/notes" className="text-xs text-muted-foreground hover:underline">← Notes</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight flex-1">{note.title}</h1>
        {canEdit ? (
          <>
            <form action={togglePinNoteAction.bind(null, note.id)}>
              <Button type="submit" size="sm" variant="outline">{note.pinned ? "Unpin" : "Pin"}</Button>
            </form>
            <form action={toggleArchiveNoteAction.bind(null, note.id)}>
              <Button type="submit" size="sm" variant="outline">{note.archived ? "Unarchive" : "Archive"}</Button>
            </form>
          </>
        ) : null}
        {canDelete ? (
          <form action={deleteNoteAction.bind(null, note.id)}>
            <Button type="submit" size="sm" variant="destructive">Delete</Button>
          </form>
        ) : null}
      </div>

      <Card className="p-6">
        <form action={updateNoteAction.bind(null, note.id)} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={note.title} required maxLength={200} disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="notebookId">Notebook</Label>
            <Select id="notebookId" name="notebookId" defaultValue={note.notebookId ?? ""} disabled={!canEdit}>
              <option value="">— None —</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" name="content" defaultValue={note.content} rows={18} maxLength={50000} disabled={!canEdit} />
          </div>
          <p className="text-xs text-muted-foreground">Updated {note.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</p>
          {canEdit ? <Button type="submit">Save changes</Button> : null}
        </form>
      </Card>
    </div>
  );
}
