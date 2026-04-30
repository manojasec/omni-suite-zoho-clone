import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublicHelpArticlePage({
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

  const article = await prisma.kbArticle.findFirst({
    where: {
      workspaceId: workspace.id,
      slug,
      status: "PUBLISHED",
    },
    include: {
      category: { select: { name: true, slug: true } },
    },
  });
  if (!article) notFound();

  // Fire-and-forget view increment. Errors are swallowed because the read
  // is the user-visible operation.
  prisma.kbArticle
    .update({ where: { id: article.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={`/help/${workspaceSlug}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Help Center
        </Link>
        {article.category ? (
          <>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/help/${workspaceSlug}/${article.category.slug}`}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {article.category.name}
            </Link>
          </>
        ) : null}
      </p>

      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="mt-2 text-base text-muted-foreground">{article.excerpt}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          {article.publishedAt
            ? `Published ${article.publishedAt.toISOString().slice(0, 10)}`
            : `Updated ${article.updatedAt.toISOString().slice(0, 10)}`}{" "}
          · {article.views + 1} views
        </p>
      </header>

      <Card className="p-6">
        <article className="whitespace-pre-wrap text-sm leading-relaxed">
          {article.body}
        </article>
      </Card>
    </div>
  );
}
