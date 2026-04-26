import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  KB_ARTICLE_STATUSES,
  KB_ARTICLE_STATUS_LABELS,
  buildCategoryTree,
  formatDate,
  summarizeArticles,
  type CategoryNode,
} from "@/modules/help/schemas";
import {
  createKbCategoryAction,
  deleteKbCategoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

function CategoryRow({
  node,
  depth,
  canDelete,
}: {
  node: CategoryNode;
  depth: number;
  canDelete: boolean;
}) {
  return (
    <>
      <li
        className="flex items-center justify-between gap-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <Link
          href={`/app/help?category=${node.id}`}
          className="font-medium hover:underline"
        >
          📁 {node.name}
        </Link>
        {canDelete ? (
          <form action={deleteKbCategoryAction.bind(null, node.id)}>
            <Button type="submit" size="sm" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </li>
      {node.children.map((c) => (
        <CategoryRow
          key={c.id}
          node={c}
          depth={depth + 1}
          canDelete={canDelete}
        />
      ))}
    </>
  );
}

export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "view");

  const status =
    sp.status && KB_ARTICLE_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof KB_ARTICLE_STATUSES)[number])
      : undefined;
  const categoryId = sp.category ?? undefined;
  const q = (sp.q ?? "").trim();

  const [articles, summarySource, categories] = await Promise.all([
    prisma.kbArticle.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { excerpt: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        excerpt: true,
        views: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.kbArticle.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true },
    }),
    prisma.kbCategory.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true, slug: true, parentId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const summary = summarizeArticles(summarySource);
  const tree = buildCategoryTree(categories);
  const canCreate = can(ctx.role, "kbArticle", "create");
  const canDeleteCat = can(ctx.role, "kbArticle", "delete");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Help Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Knowledge base articles organized by category.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/help/articles/new">
            <Button size="sm">New article</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {KB_ARTICLE_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {KB_ARTICLE_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{summary[s]}</div>
          </Card>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-2 text-xs">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Title or excerpt" />
        </div>
        {status ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
        {categoryId ? (
          <input type="hidden" name="category" value={categoryId} />
        ) : null}
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {q || status || categoryId ? (
          <Link href="/app/help" className="text-xs text-muted-foreground hover:underline">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={`/app/help${categoryId ? `?category=${categoryId}` : ""}`}
          className={
            "rounded px-2 py-1 " +
            (!status
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent")
          }
        >
          All statuses
        </Link>
        {KB_ARTICLE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/help?status=${s}${categoryId ? `&category=${categoryId}` : ""}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {KB_ARTICLE_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Categories</h2>
          {tree.length === 0 ? (
            <p className="text-xs text-muted-foreground">No categories yet.</p>
          ) : (
            <ul>
              {tree.map((n) => (
                <CategoryRow
                  key={n.id}
                  node={n}
                  depth={0}
                  canDelete={canDeleteCat}
                />
              ))}
            </ul>
          )}

          {canCreate ? (
            <form
              action={createKbCategoryAction}
              className="mt-3 grid gap-2 border-t pt-3"
            >
              <div>
                <Label htmlFor="name">Category name</Label>
                <Input id="name" name="name" required maxLength={160} />
              </div>
              <div>
                <Label htmlFor="parentId">Parent</Label>
                <Select id="parentId" name="parentId">
                  <option value="">— Root —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add category
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <div className="space-y-2">
          {articles.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No articles match this filter.
            </Card>
          ) : (
            <Card className="divide-y">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/app/help/articles/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      /{a.slug} · {a.views} view
                      {a.views === 1 ? "" : "s"} · updated{" "}
                      {formatDate(a.updatedAt)}
                      {a.category ? ` · ${a.category.name}` : ""}
                    </div>
                    {a.excerpt ? (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {a.excerpt}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs font-medium " +
                      (statusColor[a.status] ?? "bg-zinc-100 text-zinc-700")
                    }
                  >
                    {KB_ARTICLE_STATUS_LABELS[a.status]}
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
