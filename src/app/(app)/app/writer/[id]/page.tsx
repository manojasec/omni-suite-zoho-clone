import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  WRITER_DOC_STATUS_LABELS,
  WRITER_DOC_TRANSITIONS,
  WRITER_DOC_VISIBILITIES,
  WRITER_DOC_VISIBILITY_LABELS,
  formatDateTime,
  formatReadingTime,
} from "@/modules/writer/schemas";
import {
  deleteWriterDocAction,
  transitionWriterDocAction,
  updateWriterDocAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function WriterDocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "view");

  const [doc, folders, versionCount] = await Promise.all([
    prisma.writerDoc.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    }),
    prisma.writerFolder.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.writerDocVersion.count({ where: { docId: id } }),
  ]);
  if (!doc) notFound();

  const canEdit = can(ctx.role, "writerDoc", "edit");
  const canDelete = can(ctx.role, "writerDoc", "delete");
  const transitions = WRITER_DOC_TRANSITIONS[doc.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">
            {doc.wordCount} word{doc.wordCount === 1 ? "" : "s"} ·{" "}
            {formatReadingTime(doc.wordCount)} · updated{" "}
            {formatDateTime(doc.updatedAt)}
            {doc.publishedAt
              ? ` · published ${formatDateTime(doc.publishedAt)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[doc.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {WRITER_DOC_STATUS_LABELS[doc.status]}
          </span>
          {canEdit
            ? transitions.map((t) => (
                <form
                  key={t}
                  action={transitionWriterDocAction.bind(null, doc.id)}
                >
                  <input type="hidden" name="status" value={t} />
                  <Button type="submit" size="sm" variant="outline">
                    {t === "PUBLISHED"
                      ? "Publish"
                      : t === "ARCHIVED"
                        ? "Archive"
                        : "Move to draft"}
                  </Button>
                </form>
              ))
            : null}
          <Link href={`/app/writer/${doc.id}/versions`}>
            <Button size="sm" variant="outline">
              Versions ({versionCount})
            </Button>
          </Link>
          {canDelete && doc.status !== "PUBLISHED" ? (
            <form action={deleteWriterDocAction.bind(null, doc.id)}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
          <Link
            href="/app/writer"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      <Card className="p-4">
        {canEdit ? (
          <form
            action={updateWriterDocAction.bind(null, doc.id)}
            className="grid gap-3"
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={doc.title}
                required
                maxLength={200}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="folderId">Folder</Label>
                <Select
                  id="folderId"
                  name="folderId"
                  defaultValue={doc.folderId ?? ""}
                >
                  <option value="">— Root —</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  id="visibility"
                  name="visibility"
                  defaultValue={doc.visibility}
                >
                  {WRITER_DOC_VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {WRITER_DOC_VISIBILITY_LABELS[v]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                name="content"
                rows={20}
                defaultValue={doc.content}
                maxLength={200_000}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Saving creates a new version snapshot when content changes.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {WRITER_DOC_VISIBILITY_LABELS[doc.visibility]}
            </div>
            <article className="whitespace-pre-wrap text-sm leading-6">
              {doc.content || (
                <span className="text-muted-foreground">No content yet.</span>
              )}
            </article>
          </div>
        )}
      </Card>
    </div>
  );
}
