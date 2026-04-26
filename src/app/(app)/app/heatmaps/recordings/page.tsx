import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  SESSION_RECORDING_STATUSES,
  SESSION_RECORDING_STATUS_LABELS,
  formatDate,
  formatDuration,
} from "@/modules/heatmaps/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  RECORDING: "bg-rose-100 text-rose-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-100 text-zinc-700",
};

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; siteId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "sessionRecording", "view");

  const status =
    sp.status && SESSION_RECORDING_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof SESSION_RECORDING_STATUSES)[number])
      : undefined;

  const sites = await prisma.heatmapSite.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const recordings = await prisma.sessionRecording.findMany({
    where: {
      site: { workspaceId: ctx.workspaceId },
      ...(status ? { status } : {}),
      ...(sp.siteId ? { siteId: sp.siteId } : {}),
    },
    include: { site: { select: { id: true, name: true, domain: true } } },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  const counts: Record<(typeof SESSION_RECORDING_STATUSES)[number], number> = {
    RECORDING: 0,
    COMPLETED: 0,
    ARCHIVED: 0,
  };
  const totals = await prisma.sessionRecording.groupBy({
    by: ["status"],
    where: { site: { workspaceId: ctx.workspaceId } },
    _count: { _all: true },
  });
  for (const t of totals) counts[t.status] = t._count._all;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Session recordings</h1>
          <p className="text-sm text-muted-foreground">
            Replay user sessions captured by your heatmap tracker.
          </p>
        </div>
        <Link
          href="/app/heatmaps"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to heatmaps
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {SESSION_RECORDING_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {SESSION_RECORDING_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{counts[s]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/heatmaps/recordings"
          className={
            "rounded px-2 py-1 " +
            (!status && !sp.siteId
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent")
          }
        >
          All
        </Link>
        {SESSION_RECORDING_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/heatmaps/recordings?status=${s}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {SESSION_RECORDING_STATUS_LABELS[s]}
          </Link>
        ))}
        {sites.length > 0 ? (
          <span className="ml-auto text-muted-foreground">
            Filter by site:{" "}
            {sites.map((s) => (
              <Link
                key={s.id}
                href={`/app/heatmaps/recordings?siteId=${s.id}`}
                className={
                  "ml-1 rounded px-2 py-0.5 " +
                  (sp.siteId === s.id
                    ? "bg-foreground text-background"
                    : "bg-muted hover:bg-accent")
                }
              >
                {s.name}
              </Link>
            ))}
          </span>
        ) : null}
      </div>

      {recordings.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No recordings yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {recordings.map((r) => (
            <Link
              key={r.id}
              href={`/app/heatmaps/recordings/${r.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {r.site.name} · {r.visitorId.slice(0, 12)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(r.startedAt)} · {r.pageCount} page
                  {r.pageCount === 1 ? "" : "s"} · {r.eventCount} events ·{" "}
                  {formatDuration(r.durationMs)}
                </div>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[r.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {SESSION_RECORDING_STATUS_LABELS[r.status]}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
