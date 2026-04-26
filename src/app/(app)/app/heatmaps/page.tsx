import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HEATMAP_SITE_STATUS_LABELS,
  summarizeSitesByStatus,
} from "@/modules/heatmaps/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-zinc-100 text-zinc-700",
};

export default async function HeatmapSitesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "view");

  const sites = await prisma.heatmapSite.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pages: true, recordings: true } } },
  });

  const summary = summarizeSitesByStatus(sites);
  const canCreate = can(ctx.role, "heatmapSite", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Heatmaps</h1>
          <p className="text-sm text-muted-foreground">
            Track click, move, and scroll heatmaps across your web properties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/heatmaps/recordings">
            <Button variant="outline">Recordings</Button>
          </Link>
          {canCreate ? (
            <Link href="/app/heatmaps/new">
              <Button>New site</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active sites</div>
          <div className="mt-1 text-2xl font-semibold">{summary.ACTIVE}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Paused</div>
          <div className="mt-1 text-2xl font-semibold">{summary.PAUSED}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-semibold">{sites.length}</div>
        </Card>
      </div>

      {sites.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No heatmap sites yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {sites.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/heatmaps/${s.id}`}
                  className="font-medium hover:underline"
                >
                  {s.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {s.domain} · {s._count.pages} page
                  {s._count.pages === 1 ? "" : "s"} · {s._count.recordings} recording
                  {s._count.recordings === 1 ? "" : "s"} · sample {s.sampleRate}%
                </p>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[s.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {HEATMAP_SITE_STATUS_LABELS[s.status]}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
