import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  HEATMAP_EVENT_KIND_LABELS,
  HEATMAP_SITE_STATUSES,
  HEATMAP_SITE_STATUS_LABELS,
  bucketEvents,
  formatDate,
  summarizeHeatmapEvents,
} from "@/modules/heatmaps/schemas";
import {
  createHeatmapPageAction,
  deleteHeatmapPageAction,
  deleteHeatmapSiteAction,
  rotateTrackerKeyAction,
  toggleHeatmapSiteStatusAction,
  updateHeatmapSiteAction,
} from "../actions";

export const dynamic = "force-dynamic";

const BINS = 20;

function HeatmapGrid({
  events,
}: {
  events: { xPercent: number; yPercent: number }[];
}) {
  const cells = bucketEvents(events, BINS);
  const max = cells.reduce((m, c) => (c.count > m ? c.count : m), 0) || 1;
  const grid: number[][] = Array.from({ length: BINS }, () =>
    Array.from({ length: BINS }, () => 0),
  );
  for (const c of cells) grid[c.y][c.x] = c.count;

  return (
    <div
      className="relative overflow-hidden rounded-md border bg-zinc-50"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${BINS}, 1fr)`,
          gridTemplateRows: `repeat(${BINS}, 1fr)`,
        }}
      >
        {grid.map((row, yi) =>
          row.map((count, xi) => {
            const intensity = count / max;
            const opacity = count === 0 ? 0 : 0.15 + 0.85 * intensity;
            return (
              <div
                key={`${xi}-${yi}`}
                title={count > 0 ? `${count} hit${count === 1 ? "" : "s"}` : undefined}
                style={{
                  backgroundColor:
                    count === 0 ? "transparent" : `rgba(220, 38, 38, ${opacity})`,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

export default async function HeatmapSiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; kind?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "view");

  const site = await prisma.heatmapSite.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!site) notFound();

  const pages = await prisma.heatmapPage.findMany({
    where: { siteId: site.id },
    orderBy: { path: "asc" },
  });

  const selectedPageId =
    sp.page && pages.some((p) => p.id === sp.page) ? sp.page : pages[0]?.id ?? null;
  const selectedKind =
    sp.kind === "MOVE" || sp.kind === "SCROLL" || sp.kind === "CLICK"
      ? sp.kind
      : "CLICK";

  const events = selectedPageId
    ? await prisma.heatmapEvent.findMany({
        where: { pageId: selectedPageId, kind: selectedKind },
        select: { xPercent: true, yPercent: true, kind: true },
        take: 5000,
        orderBy: { occurredAt: "desc" },
      })
    : [];

  const allEvents = selectedPageId
    ? await prisma.heatmapEvent.findMany({
        where: { pageId: selectedPageId },
        select: { kind: true },
      })
    : [];
  const summary = summarizeHeatmapEvents(allEvents);

  const canEdit = can(ctx.role, "heatmapSite", "edit");
  const canDelete = can(ctx.role, "heatmapSite", "delete");
  const canCreatePage = can(ctx.role, "heatmapPage", "create");
  const canDeletePage = can(ctx.role, "heatmapPage", "delete");

  const updateBound = updateHeatmapSiteAction.bind(null, site.id);
  const toggleBound = toggleHeatmapSiteStatusAction.bind(null, site.id);
  const rotateBound = rotateTrackerKeyAction.bind(null, site.id);
  const deleteSiteBound = deleteHeatmapSiteAction.bind(null, site.id);
  const createPageBound = createHeatmapPageAction.bind(null, site.id);

  const eventsAsNumbers = events.map((e) => ({
    xPercent: Number(e.xPercent),
    yPercent: Number(e.yPercent),
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
          <p className="text-sm text-muted-foreground">
            {site.domain} · {HEATMAP_SITE_STATUS_LABELS[site.status]} · sample{" "}
            {site.sampleRate}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <form action={toggleBound}>
              <input
                type="hidden"
                name="to"
                value={site.status === "ACTIVE" ? "PAUSED" : "ACTIVE"}
              />
              <Button type="submit" variant="outline" size="sm">
                {site.status === "ACTIVE" ? "Pause" : "Resume"}
              </Button>
            </form>
          ) : null}
          {canDelete && site.status !== "ACTIVE" ? (
            <form action={deleteSiteBound}>
              <Button type="submit" variant="outline" size="sm">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Tracker key</h2>
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
            {site.trackerKey}
          </code>
          {canEdit ? (
            <form action={rotateBound}>
              <Button type="submit" size="sm" variant="outline">
                Rotate
              </Button>
            </form>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Pages</h2>
          {pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages tracked yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {pages.map((p) => {
                const active = p.id === selectedPageId;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/app/heatmaps/${site.id}?page=${p.id}&kind=${selectedKind}`}
                      className={
                        "min-w-0 flex-1 truncate hover:underline " +
                        (active ? "font-semibold" : "")
                      }
                    >
                      {p.label || p.path}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {p.viewCount} views
                    </span>
                    {canDeletePage ? (
                      <form action={deleteHeatmapPageAction.bind(null, p.id)}>
                        <Button type="submit" size="sm" variant="ghost">
                          ×
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {canCreatePage ? (
            <form action={createPageBound} className="mt-4 grid gap-2 border-t pt-4">
              <div>
                <Label htmlFor="path">Path</Label>
                <Input
                  id="path"
                  name="path"
                  required
                  placeholder="/pricing"
                />
              </div>
              <div>
                <Label htmlFor="label">Label (optional)</Label>
                <Input id="label" name="label" placeholder="Pricing page" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Track page
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Heatmap{" "}
              {selectedPageId
                ? `· ${pages.find((p) => p.id === selectedPageId)?.path ?? ""}`
                : ""}
            </h2>
            {selectedPageId ? (
              <div className="flex items-center gap-2 text-xs">
                {(["CLICK", "MOVE", "SCROLL"] as const).map((k) => (
                  <Link
                    key={k}
                    href={`/app/heatmaps/${site.id}?page=${selectedPageId}&kind=${k}`}
                    className={
                      "rounded px-2 py-0.5 " +
                      (k === selectedKind
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-accent")
                    }
                  >
                    {HEATMAP_EVENT_KIND_LABELS[k]}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {!selectedPageId ? (
            <p className="text-sm text-muted-foreground">
              Add a page to start collecting heatmap data.
            </p>
          ) : eventsAsNumbers.length === 0 ? (
            <div className="flex aspect-video items-center justify-center rounded-md border bg-zinc-50 text-sm text-muted-foreground">
              No {HEATMAP_EVENT_KIND_LABELS[selectedKind].toLowerCase()} recorded
              yet.
            </div>
          ) : (
            <HeatmapGrid events={eventsAsNumbers} />
          )}

          <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
            <div>
              Clicks: <strong>{summary.byKind.CLICK}</strong>
            </div>
            <div>
              Moves: <strong>{summary.byKind.MOVE}</strong>
            </div>
            <div>
              Scrolls: <strong>{summary.byKind.SCROLL}</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Site settings</h2>
        <form action={updateBound} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={site.name}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              name="domain"
              required
              defaultValue={site.domain}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={site.status}
              disabled={!canEdit}
            >
              {HEATMAP_SITE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {HEATMAP_SITE_STATUS_LABELS[st]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sampleRate">Sample rate %</Label>
            <Input
              id="sampleRate"
              name="sampleRate"
              type="number"
              min={1}
              max={100}
              defaultValue={site.sampleRate}
              disabled={!canEdit}
            />
          </div>
          {canEdit ? (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Created {formatDate(site.createdAt)} · Updated {formatDate(site.updatedAt)}
        </p>
      </Card>
    </div>
  );
}
