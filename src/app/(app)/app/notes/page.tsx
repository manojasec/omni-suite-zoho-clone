import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NOTE_COLORS, colorClass } from "@/modules/notes/schemas";
import { createNotebookAction, deleteNotebookAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotesListPage({
  searchParams,
}: {
  searchParams: Promise<{ notebook?: string; archived?: string; q?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "view");
  const sp = await searchParams;
  const archived = sp.archived === "1";
  const notebookId = sp.notebook && sp.notebook !== "all" ? sp.notebook : undefined;
  const q = (sp.q ?? "").trim();

  const [notebooks, notes] = await Promise.all([
    prisma.notebook.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.note.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        archived,
        ...(notebookId ? { notebookId } : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      include: { notebook: true },
      take: 200,
    }),
  ]);

  const canCreateNote = can(ctx.role, "note", "create");
  const canCreateNotebook = can(ctx.role, "notebook", "create");
  const canDeleteNotebook = can(ctx.role, "notebook", "delete");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        {canCreateNote ? (
          <Link href="/app/notes/new"><Button>New note</Button></Link>
        ) : null}
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Title or content..." />
          </div>
          <div>
            <Label htmlFor="notebook">Notebook</Label>
            <Select id="notebook" name="notebook" defaultValue={notebookId ?? "all"}>
              <option value="all">All notebooks</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="archived">View</Label>
            <Select id="archived" name="archived" defaultValue={archived ? "1" : "0"}>
              <option value="0">Active</option>
              <option value="1">Archived</option>
            </Select>
          </div>
          <div className="flex items-end"><Button type="submit" variant="outline">Apply</Button></div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="p-4 h-fit">
          <h2 className="text-sm font-semibold mb-3">Notebooks</h2>
          <ul className="space-y-1">
            {notebooks.map((nb) => (
              <li key={nb.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/notes?notebook=${nb.id}`} className="flex items-center gap-2 text-sm hover:underline">
                  <span className={`inline-block h-2 w-2 rounded-full ${colorClass(nb.color)}`} />
                  {nb.name}
                </Link>
                {canDeleteNotebook ? (
                  <form action={deleteNotebookAction.bind(null, nb.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">×</button>
                  </form>
                ) : null}
              </li>
            ))}
            {notebooks.length === 0 ? <li className="text-xs text-muted-foreground">No notebooks yet.</li> : null}
          </ul>
          {canCreateNotebook ? (
            <form action={createNotebookAction} className="mt-4 space-y-2 border-t pt-3">
              <Input name="name" placeholder="New notebook" required maxLength={160} />
              <Select name="color" defaultValue="slate">
                {NOTE_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Button type="submit" size="sm" variant="outline" className="w-full">Add notebook</Button>
            </form>
          ) : null}
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((n) => {
            const cc = colorClass(n.notebook?.color ?? "slate");
            return (
              <Link key={n.id} href={`/app/notes/${n.id}`} className="block">
                <Card className={`p-4 h-full border-l-4 ${cc} transition hover:shadow`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{n.title}</h3>
                    {n.pinned ? <span className="text-xs">📌</span> : null}
                  </div>
                  {n.notebook ? <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{n.notebook.name}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">{n.content || <em>(empty)</em>}</p>
                  <p className="mt-3 text-[10px] text-muted-foreground">{n.updatedAt.toISOString().slice(0, 10)}</p>
                </Card>
              </Link>
            );
          })}
          {notes.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
              No {archived ? "archived" : ""} notes match your filters.
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
