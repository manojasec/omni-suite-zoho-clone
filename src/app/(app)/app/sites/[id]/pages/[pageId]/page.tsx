import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SITE_PAGE_STATUSES,
  SITE_PAGE_STATUS_LABELS,
  renderSiteMarkdown,
} from "@/modules/sites/schemas";
import { updateSitePageAction } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function SitePageEditor({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sitePage", "view");
  const { id: siteId, pageId } = await params;

  const page = await prisma.sitePage.findFirst({
    where: { id: pageId, siteId, site: { workspaceId: ctx.workspaceId } },
    include: { site: true },
  });
  if (!page) notFound();

  const canEdit = can(ctx.role, "sitePage", "edit");
  const previewHtml = renderSiteMarkdown(page.body);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href={`/app/sites/${siteId}`} className="hover:underline">← {page.site.name}</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-sm text-muted-foreground">
          /site/{page.site.slug}/{page.slug} · {SITE_PAGE_STATUS_LABELS[page.status]}
          {page.isHome ? " · home" : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Edit</h2>
          {canEdit ? (
            <form action={updateSitePageAction.bind(null, siteId, pageId)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" defaultValue={page.title} required maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" defaultValue={page.slug} required maxLength={80} />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={page.status}>
                  {SITE_PAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>{SITE_PAGE_STATUS_LABELS[s]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Order</Label>
                <Input
                  id="position"
                  name="position"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={page.position}
                />
              </div>
              <div>
                <Label htmlFor="body">Content (markdown-lite)</Label>
                <Textarea
                  id="body"
                  name="body"
                  defaultValue={page.body}
                  rows={18}
                  className="font-mono text-xs"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports # / ## / ### headings, **bold**, *italic*, [text](https://link), --- divider.
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">Save page</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">You don&apos;t have permission to edit this page.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Preview</h2>
          <div
            className="prose prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_hr]:my-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </Card>
      </div>
    </div>
  );
}
