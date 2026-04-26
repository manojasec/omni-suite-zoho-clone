import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  WRITER_DOC_STATUSES,
  WRITER_DOC_STATUS_LABELS,
  buildFolderTree,
  formatDate,
  formatReadingTime,
  summarizeDocs,
  type FolderNode,
} from "@/modules/writer/schemas";
import {
  createWriterFolderAction,
  deleteWriterFolderAction,
} from "./actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

function FolderRow({
  node,
  depth,
  canDelete,
}: {
  node: FolderNode;
  depth: number;
  canDelete: boolean;
}) {
  return (
    <>
      <li
        className="flex items-center justify-between gap-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <span className="font-medium">📁 {node.name}</span>
        {canDelete ? (
          <form action={deleteWriterFolderAction.bind(null, node.id)}>
            <Button type="submit" size="sm" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </li>
      {node.children.map((c) => (
        <FolderRow
          key={c.id}
          node={c}
          depth={depth + 1}
          canDelete={canDelete}
        />
      ))}
    </>
  );
}

export default async function WriterIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; folder?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "view");

  const status =
    sp.status && WRITER_DOC_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof WRITER_DOC_STATUSES)[number])
      : undefined;
  const folderId = sp.folder ?? undefined;

  const [docs, summarySource, folders] = await Promise.all([
    prisma.writerDoc.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
        ...(folderId ? { folderId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        wordCount: true,
        updatedAt: true,
        folderId: true,
      },
    }),
    prisma.writerDoc.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true },
    }),
    prisma.writerFolder.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const summary = summarizeDocs(summarySource);
  const tree = buildFolderTree(folders);
  const canCreate = can(ctx.role, "writerDoc", "create");
  const canDeleteFolder = can(ctx.role, "writerDoc", "delete");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Writer</h1>
          <p className="text-sm text-muted-foreground">
            Collaborative documents with folders, versions, and publishing.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/writer/new">
            <Button size="sm">New doc</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {WRITER_DOC_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {WRITER_DOC_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{summary[s]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/writer"
          className={
            "rounded px-2 py-1 " +
            (!status && !folderId
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent")
          }
        >
          All
        </Link>
        {WRITER_DOC_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/writer?status=${s}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {WRITER_DOC_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Folders</h2>
          {tree.length === 0 ? (
            <p className="text-xs text-muted-foreground">No folders yet.</p>
          ) : (
            <ul>
              {tree.map((n) => (
                <FolderRow
                  key={n.id}
                  node={n}
                  depth={0}
                  canDelete={canDeleteFolder}
                />
              ))}
            </ul>
          )}

          {canCreate ? (
            <form
              action={createWriterFolderAction}
              className="mt-3 grid gap-2 border-t pt-3"
            >
              <div>
                <Label htmlFor="name">Folder name</Label>
                <Input id="name" name="name" required maxLength={160} />
              </div>
              <div>
                <Label htmlFor="parentId">Parent</Label>
                <Select id="parentId" name="parentId">
                  <option value="">— Root —</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add folder
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <div className="space-y-2">
          {docs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No docs match this filter.
            </Card>
          ) : (
            <Card className="divide-y">
              {docs.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/writer/${d.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(d.updatedAt)} · {d.wordCount} word
                      {d.wordCount === 1 ? "" : "s"} ·{" "}
                      {formatReadingTime(d.wordCount)}
                    </div>
                  </div>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs font-medium " +
                      (statusColor[d.status] ?? "bg-zinc-100 text-zinc-700")
                    }
                  >
                    {WRITER_DOC_STATUS_LABELS[d.status]}
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
