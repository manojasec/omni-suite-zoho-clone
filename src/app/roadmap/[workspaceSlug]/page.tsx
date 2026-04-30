import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ROADMAP_STATUSES,
  formatRoadmapStatus,
  groupItemsByStatus,
  roadmapStatusColor,
  type RoadmapStatus,
} from "@/modules/roadmap/schemas";
import { voteRoadmapItemAction } from "@/app/(app)/app/roadmap/actions";

export const dynamic = "force-dynamic";

export default async function PublicRoadmapPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const items = await prisma.roadmapItem.findMany({
    where: { workspaceId: workspace.id, isPublic: true },
    orderBy: [{ voteCount: "desc" }, { position: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      position: true,
      voteCount: true,
    },
  });

  const grouped = groupItemsByStatus(
    items.map((it) => ({ ...it, status: it.status as RoadmapStatus })),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Roadmap</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          What we're working on. Vote with your email to help us prioritize.
        </p>
      </header>

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No public roadmap items yet. Check back soon.
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {ROADMAP_STATUSES.map((status) => (
            <PublicColumn
              key={status}
              status={status}
              items={grouped[status]}
              workspaceId={workspace.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type PublicItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  voteCount: number;
};

function PublicColumn({
  status,
  items,
  workspaceId,
}: {
  status: RoadmapStatus;
  items: PublicItem[];
  workspaceId: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${roadmapStatusColor(status)}`}
        >
          {formatRoadmapStatus(status)}
        </span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <Card className="p-4 text-xs text-muted-foreground">Nothing here yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{it.title}</h3>
                  {it.category ? (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {it.category}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-semibold">{it.voteCount}</div>
                  <div className="text-[10px] text-muted-foreground">votes</div>
                </div>
              </div>
              {it.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {it.description}
                </p>
              ) : null}
              {status !== "SHIPPED" ? (
                <form
                  action={voteRoadmapItemAction.bind(null, workspaceId, it.id)}
                  className="mt-3 flex gap-2"
                >
                  <Input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="flex-1"
                  />
                  <Button type="submit" size="sm">
                    Vote
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
