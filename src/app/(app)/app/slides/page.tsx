import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PRESENTATION_STATUSES,
  PRESENTATION_STATUS_LABELS,
  formatDate,
  summarizePresentations,
} from "@/modules/slides/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function SlidesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "view");

  const status =
    sp.status && PRESENTATION_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof PRESENTATION_STATUSES)[number])
      : undefined;

  const [decks, summarySource] = await Promise.all([
    prisma.presentation.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        updatedAt: true,
        publishedAt: true,
        _count: { select: { slides: true } },
      },
    }),
    prisma.presentation.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true },
    }),
  ]);

  const summary = summarizePresentations(summarySource);
  const canCreate = can(ctx.role, "presentation", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Slides</h1>
          <p className="text-sm text-muted-foreground">
            Build presentations with ordered slides and layouts.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/slides/new">
            <Button size="sm">New deck</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {PRESENTATION_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {PRESENTATION_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{summary[s]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/slides"
          className={
            "rounded px-2 py-1 " +
            (!status
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent")
          }
        >
          All
        </Link>
        {PRESENTATION_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/slides?status=${s}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {PRESENTATION_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {decks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No decks match this filter.
        </Card>
      ) : (
        <Card className="divide-y">
          {decks.map((d) => (
            <Link
              key={d.id}
              href={`/app/slides/${d.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">
                  {d._count.slides} slide
                  {d._count.slides === 1 ? "" : "s"} · updated{" "}
                  {formatDate(d.updatedAt)}
                  {d.description ? ` · ${d.description}` : ""}
                </div>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[d.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {PRESENTATION_STATUS_LABELS[d.status]}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
