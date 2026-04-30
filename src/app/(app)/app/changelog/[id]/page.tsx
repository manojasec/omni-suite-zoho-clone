import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ENTRY_STATUSES,
  ENTRY_TYPES,
  formatEntryType,
} from "@/modules/changelog/schemas";
import { deleteEntryAction, updateEntryAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChangelogEntryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "changelog", "view");
  const canEdit = can(ctx.role, "changelog", "edit");
  const canDelete = can(ctx.role, "changelog", "delete");

  const [workspace, entry] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { slug: true },
    }),
    prisma.changelogEntry.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    }),
  ]);
  if (!entry) notFound();

  const publicUrl = `/changelog/${workspace?.slug ?? ""}/${entry.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/changelog" className="text-xs text-muted-foreground hover:underline">
          ← Changelog
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.status === "PUBLISHED" ? (
            <Link href={publicUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {publicUrl}
            </Link>
          ) : (
            "Draft (not yet published)"
          )}
        </p>
      </div>

      <Card className="p-4">
        <form action={updateEntryAction.bind(null, entry.id)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={entry.title}
                required
                maxLength={200}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={entry.slug}
                pattern="[a-z0-9\-]+"
                maxLength={200}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue={entry.type} disabled={!canEdit}>
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatEntryType(t)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                defaultValue={entry.status}
                disabled={!canEdit}
              >
                {ENTRY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "DRAFT" ? "Draft" : "Published"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <Input
              id="excerpt"
              name="excerpt"
              defaultValue={entry.excerpt ?? ""}
              maxLength={500}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              name="body"
              defaultValue={entry.body}
              rows={12}
              required
              maxLength={50000}
              disabled={!canEdit}
            />
          </div>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
      </Card>

      {canDelete ? (
        <Card className="p-4">
          <form action={deleteEntryAction.bind(null, entry.id)}>
            <Button type="submit" variant="ghost">
              Delete entry
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
