import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CREATOR_APP_STATUSES,
  CREATOR_APP_STATUS_LABELS,
  formatDate,
  summarizeApps,
} from "@/modules/creator/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function CreatorIndexPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "view");

  const apps = await prisma.creatorApp.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: {
      _count: { select: { entities: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const summary = summarizeApps(apps);
  const canCreate = can(ctx.role, "creatorApp", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">App Creator</h1>
          <p className="text-sm text-muted-foreground">
            Build internal apps with custom entities, fields, and records.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/creator/new">
            <Button size="sm">New app</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {CREATOR_APP_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {CREATOR_APP_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{summary[s]}</div>
          </Card>
        ))}
      </div>

      {apps.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No apps yet. Create your first app to start building.
        </Card>
      ) : (
        <Card className="divide-y">
          {apps.map((a) => (
            <Link
              key={a.id}
              href={`/app/creator/${a.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {a.icon ? <span>{a.icon}</span> : null}
                  {a.name}
                  <code className="text-xs text-muted-foreground">
                    /{a.slug}
                  </code>
                </div>
                {a.description ? (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {a.description}
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-muted-foreground">
                  {a._count.entities} entit
                  {a._count.entities === 1 ? "y" : "ies"} · updated{" "}
                  {formatDate(a.updatedAt)}
                </div>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[a.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {CREATOR_APP_STATUS_LABELS[a.status]}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
