import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SITE_PAGE_STATUS_LABELS } from "@/modules/sites/schemas";
import {
  updateSiteAction,
  publishSiteAction,
  deleteSiteAction,
  createSitePageAction,
  setSiteHomePageAction,
  deleteSitePageAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "view");
  const { id } = await params;

  const site = await prisma.site.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      pages: { orderBy: [{ isHome: "desc" }, { position: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!site) notFound();

  const canEdit = can(ctx.role, "site", "edit");
  const canDelete = can(ctx.role, "site", "delete");
  const canCreatePage = can(ctx.role, "sitePage", "create");
  const canEditPage = can(ctx.role, "sitePage", "edit");
  const canDeletePage = can(ctx.role, "sitePage", "delete");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
            <p className="text-sm text-muted-foreground">
              /site/{site.slug} · {site.published ? "Live" : "Draft"} · {site.pages.length} pages
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <form action={publishSiteAction.bind(null, site.id)}>
                <Button type="submit" variant={site.published ? "outline" : "default"} size="sm">
                  {site.published ? "Unpublish" : "Publish"}
                </Button>
              </form>
            ) : null}
            {site.published ? (
              <Link href={`/site/${site.slug}`} target="_blank">
                <Button variant="outline" size="sm">Visit ↗</Button>
              </Link>
            ) : null}
            {canDelete ? (
              <form action={deleteSiteAction.bind(null, site.id)}>
                <Button type="submit" variant="outline" size="sm" className="text-red-600">Delete</Button>
              </form>
            ) : null}
          </div>
        </div>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Pages</h2>
          {site.pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <ul className="divide-y">
              {site.pages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/app/sites/${site.id}/pages/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      /{p.slug} · {SITE_PAGE_STATUS_LABELS[p.status]}
                      {p.isHome ? " · home" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditPage && !p.isHome ? (
                      <form action={setSiteHomePageAction.bind(null, site.id, p.id)}>
                        <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
                          Set home
                        </button>
                      </form>
                    ) : null}
                    {canDeletePage && !p.isHome ? (
                      <form action={deleteSitePageAction.bind(null, site.id, p.id)}>
                        <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">
                          Delete
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canCreatePage ? (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Add a new page</h2>
            <form action={createSitePageAction.bind(null, site.id)} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required maxLength={200} />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" maxLength={80} placeholder="auto" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">Create page</Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>

      {canEdit ? (
        <Card className="p-4 self-start">
          <h2 className="font-semibold mb-3">Site settings</h2>
          <form action={updateSiteAction.bind(null, site.id)} className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={site.name} required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" defaultValue={site.slug} required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={500} defaultValue={site.description ?? ""} />
            </div>
            <div>
              <Label htmlFor="themeColor">Theme color</Label>
              <Input id="themeColor" name="themeColor" type="color" defaultValue={site.themeColor} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">Save</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
