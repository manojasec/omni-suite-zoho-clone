import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  entryTypeColor,
  formatEntryType,
  groupEntriesByMonth,
  type EntryType,
} from "@/modules/changelog/schemas";

export const dynamic = "force-dynamic";

export default async function PublicChangelogPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const entries = await prisma.changelogEntry.findMany({
    where: { workspaceId: workspace.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      type: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  const groups = groupEntriesByMonth(entries);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Changelog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Recent product updates, improvements, and announcements.
        </p>
      </header>

      {entries.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No updates published yet. Check back soon.
        </Card>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h2>
              <div className="space-y-3">
                {g.entries.map((e) => (
                  <Link
                    key={e.id}
                    href={`/changelog/${workspaceSlug}/${e.slug}`}
                    className="block"
                  >
                    <Card className="p-4 transition hover:border-foreground/30">
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${entryTypeColor(e.type as EntryType)}`}
                        >
                          {formatEntryType(e.type as EntryType)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-semibold">{e.title}</h3>
                          {e.excerpt ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {e.excerpt}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {(e.publishedAt ?? e.createdAt).toISOString().slice(0, 10)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
