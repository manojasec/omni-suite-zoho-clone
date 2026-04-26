import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createKbArticleAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewKbArticlePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "create");

  const categories = await prisma.kbCategory.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New article
          </h1>
          <p className="text-sm text-muted-foreground">
            Drafts are private until published.
          </p>
        </div>
        <Link
          href="/app/help"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <form action={createKbArticleAction} className="grid gap-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="auto from title"
                maxLength={160}
              />
            </div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId">
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
              rows={2}
              maxLength={500}
              placeholder="One-line summary for search results"
            />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" name="body" rows={14} maxLength={200_000} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Create draft
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
