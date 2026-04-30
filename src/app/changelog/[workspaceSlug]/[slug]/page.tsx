import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  entryTypeColor,
  formatEntryType,
  type EntryType,
} from "@/modules/changelog/schemas";

export const dynamic = "force-dynamic";

export default async function PublicChangelogEntryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; slug: string }>;
}) {
  const { workspaceSlug, slug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const entry = await prisma.changelogEntry.findFirst({
    where: {
      workspaceId: workspace.id,
      slug,
      status: "PUBLISHED",
    },
  });
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-6 text-xs">
        <Link
          href={`/changelog/${workspaceSlug}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← All updates
        </Link>
      </p>

      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${entryTypeColor(entry.type as EntryType)}`}
          >
            {formatEntryType(entry.type as EntryType)}
          </span>
          <span className="text-xs text-muted-foreground">
            {(entry.publishedAt ?? entry.createdAt).toISOString().slice(0, 10)}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{entry.title}</h1>
        {entry.excerpt ? (
          <p className="mt-2 text-base text-muted-foreground">{entry.excerpt}</p>
        ) : null}
      </header>

      <Card className="p-6">
        <article className="whitespace-pre-wrap text-sm leading-relaxed">
          {entry.body}
        </article>
      </Card>
    </div>
  );
}
