import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublicHelpCategoryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; categorySlug: string }>;
}) {
  const { workspaceSlug, categorySlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const category = await prisma.kbCategory.findFirst({
    where: { workspaceId: workspace.id, slug: categorySlug },
    select: { id: true, name: true, description: true },
  });
  if (!category) notFound();

  const articles = await prisma.kbArticle.findMany({
    where: {
      workspaceId: workspace.id,
      categoryId: category.id,
      status: "PUBLISHED",
    },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      views: true,
      publishedAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 text-xs">
        <Link
          href={`/help/${workspaceSlug}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Help Center
        </Link>
      </p>

      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{category.name}</h1>
        {category.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
        ) : null}
      </header>

      {articles.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No articles in this category yet.
        </Card>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/help/${workspaceSlug}/article/${a.slug}`}
              className="block"
            >
              <Card className="p-4 transition hover:border-foreground/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{a.title}</div>
                    {a.excerpt ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {a.excerpt}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {a.views} view{a.views === 1 ? "" : "s"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
