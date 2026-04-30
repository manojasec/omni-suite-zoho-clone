import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  filterArticlesByQuery,
  pickPopularArticles,
} from "@/modules/help/public";

export const dynamic = "force-dynamic";

export default async function PublicHelpCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const [categories, articles] = await Promise.all([
    prisma.kbCategory.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, description: true },
    }),
    prisma.kbArticle.findMany({
      where: { workspaceId: workspace.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 500,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        views: true,
        publishedAt: true,
        categoryId: true,
      },
    }),
  ]);

  const articleCountByCategory = new Map<string, number>();
  for (const a of articles) {
    if (a.categoryId) {
      articleCountByCategory.set(
        a.categoryId,
        (articleCountByCategory.get(a.categoryId) ?? 0) + 1,
      );
    }
  }

  const popular = pickPopularArticles(articles, 6);
  const searchResults = query ? filterArticlesByQuery(articles, query) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Help Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse articles or search for an answer.
        </p>
      </header>

      <Card className="mb-8 p-4">
        <form className="flex gap-2" action="">
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search the help center…"
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {query ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for{" "}
            <span className="font-mono">"{query}"</span>
          </h2>
          {searchResults.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No articles match. Try a different search.
            </Card>
          ) : (
            <div className="space-y-2">
              {searchResults.map((a) => (
                <ArticleRow key={a.id} workspaceSlug={workspaceSlug} article={a} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {categories.length > 0 ? (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold">Categories</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((c) => {
                  const count = articleCountByCategory.get(c.id) ?? 0;
                  if (count === 0) return null;
                  return (
                    <Link
                      key={c.id}
                      href={`/help/${workspaceSlug}/${c.slug}`}
                      className="block"
                    >
                      <Card className="p-4 transition hover:border-foreground/30">
                        <div className="text-sm font-semibold">{c.name}</div>
                        {c.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {c.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {count} article{count === 1 ? "" : "s"}
                        </p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {popular.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Popular articles</h2>
              <div className="space-y-2">
                {popular.map((a) => (
                  <ArticleRow key={a.id} workspaceSlug={workspaceSlug} article={a} />
                ))}
              </div>
            </section>
          ) : (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No articles published yet.
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ArticleRow({
  workspaceSlug,
  article,
}: {
  workspaceSlug: string;
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    views: number;
  };
}) {
  return (
    <Link
      href={`/help/${workspaceSlug}/article/${article.slug}`}
      className="block"
    >
      <Card className="p-4 transition hover:border-foreground/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{article.title}</div>
            {article.excerpt ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {article.excerpt}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
            {article.views} view{article.views === 1 ? "" : "s"}
          </p>
        </div>
      </Card>
    </Link>
  );
}
