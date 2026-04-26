import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "view");

  const sites = await prisma.site.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { _count: { select: { pages: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground">
            Build landing pages and microsites for your workspace.
          </p>
        </div>
        {can(ctx.role, "site", "create") ? (
          <Link href="/app/sites/new">
            <Button>New site</Button>
          </Link>
        ) : null}
      </div>

      {sites.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No sites yet — create one to get started.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    <Link href={`/app/sites/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-muted-foreground">/site/{s.slug}</p>
                </div>
                <span
                  className={
                    "inline-flex items-center rounded px-2 py-0.5 text-xs " +
                    (s.published
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {s.published ? "Live" : "Draft"}
                </span>
              </div>
              {s.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                <span>{s._count.pages} pages</span>
                {s.published ? (
                  <Link
                    href={`/site/${s.slug}`}
                    target="_blank"
                    className="hover:underline"
                  >
                    Visit ↗
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
