import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  KB_ARTICLE_STATUS_LABELS,
  KB_ARTICLE_TRANSITIONS,
  formatDateTime,
} from "@/modules/help/schemas";
import {
  deleteKbArticleAction,
  transitionKbArticleAction,
  updateKbArticleAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function KbArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "view");

  const [article, categories] = await Promise.all([
    prisma.kbArticle.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.kbCategory.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!article) notFound();

  const canEdit = can(ctx.role, "kbArticle", "edit");
  const canDelete = can(ctx.role, "kbArticle", "delete");
  const transitions = KB_ARTICLE_TRANSITIONS[article.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {article.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            /{article.slug} · {article.views} view
            {article.views === 1 ? "" : "s"} · updated{" "}
            {formatDateTime(article.updatedAt)}
            {article.publishedAt
              ? ` · published ${formatDateTime(article.publishedAt)}`
              : ""}
            {article.category ? ` · ${article.category.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[article.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {KB_ARTICLE_STATUS_LABELS[article.status]}
          </span>
          {canEdit
            ? transitions.map((t) => (
                <form
                  key={t}
                  action={transitionKbArticleAction.bind(null, article.id)}
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
          {canDelete && article.status !== "PUBLISHED" ? (
            <form action={deleteKbArticleAction.bind(null, article.id)}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
          <Link
            href="/app/help"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      <Card className="p-4">
        {canEdit ? (
          <form
            action={updateKbArticleAction.bind(null, article.id)}
            className="grid gap-3"
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={article.title}
                required
                maxLength={200}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={article.slug}
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="categoryId">Category</Label>
                <Select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={article.categoryId ?? ""}
                >
                  <option value="">— Uncategorized —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                name="excerpt"
                defaultValue={article.excerpt ?? ""}
                rows={2}
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                name="body"
                defaultValue={article.body}
                rows={20}
                maxLength={200_000}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {article.excerpt ? (
              <p className="text-sm italic text-muted-foreground">
                {article.excerpt}
              </p>
            ) : null}
            <article className="whitespace-pre-wrap text-sm leading-6">
              {article.body || (
                <span className="text-muted-foreground">No content yet.</span>
              )}
            </article>
          </div>
        )}
      </Card>
    </div>
  );
}
