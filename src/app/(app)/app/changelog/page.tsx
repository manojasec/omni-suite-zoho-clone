import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ENTRY_STATUSES,
  ENTRY_TYPES,
  entryTypeColor,
  formatEntryType,
  type EntryType,
} from "@/modules/changelog/schemas";
import { createEntryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChangelogAdminPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "changelog", "view");
  const canCreate = can(ctx.role, "changelog", "create");

  const [workspace, entries] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { slug: true },
    }),
    prisma.changelogEntry.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ status: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const wsSlug = workspace?.slug ?? "";
  const publicUrl = `/changelog/${wsSlug}`;
  const drafts = entries.filter((e) => e.status === "DRAFT");
  const published = entries.filter((e) => e.status === "PUBLISHED");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
          <p className="text-sm text-muted-foreground">
            Public release notes timeline. Draft entries are private; publish to make them visible.
          </p>
        </div>
        <Link href={publicUrl} target="_blank" rel="noreferrer">
          <Button>View public page</Button>
        </Link>
      </div>

      <Card className="p-4 text-sm">
        <span className="text-muted-foreground">Public URL: </span>
        <code className="rounded bg-muted px-1.5 py-0.5">{publicUrl}</code>
      </Card>

      {canCreate ? (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">New entry</h2>
          <form action={createEntryAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input
                  id="slug"
                  name="slug"
                  maxLength={200}
                  pattern="[a-z0-9\-]*"
                  placeholder="auto-from-title"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="FEATURE">
                  {ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatEntryType(t)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue="DRAFT">
                  {ENTRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "DRAFT" ? "Draft" : "Published"}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt (one-liner)</Label>
              <Input id="excerpt" name="excerpt" maxLength={500} />
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" name="body" rows={6} required maxLength={50000} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Drafts ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No drafts.</Card>
        ) : (
          <Card className="divide-y p-0">
            {drafts.map((e) => (
              <Link
                key={e.id}
                href={`/app/changelog/${e.id}`}
                className="block p-4 hover:bg-muted/50"
              >
                <EntryRow entry={e} />
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Published ({published.length})
        </h2>
        {published.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Nothing published yet.</Card>
        ) : (
          <Card className="divide-y p-0">
            {published.map((e) => (
              <Link
                key={e.id}
                href={`/app/changelog/${e.id}`}
                className="block p-4 hover:bg-muted/50"
              >
                <EntryRow entry={e} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function EntryRow({
  entry,
}: {
  entry: {
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    publishedAt: Date | null;
    updatedAt: Date;
  };
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`rounded px-2 py-0.5 text-xs font-medium ${entryTypeColor(entry.type as EntryType)}`}
      >
        {formatEntryType(entry.type as EntryType)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{entry.title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          /{entry.slug} ·{" "}
          {entry.publishedAt
            ? `published ${entry.publishedAt.toISOString().slice(0, 10)}`
            : `updated ${entry.updatedAt.toISOString().slice(0, 10)}`}
        </p>
      </div>
    </div>
  );
}
