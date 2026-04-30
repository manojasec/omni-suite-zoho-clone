import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ROADMAP_STATUSES,
  formatRoadmapStatus,
  groupItemsByStatus,
  roadmapStatusColor,
  type RoadmapStatus,
} from "@/modules/roadmap/schemas";
import { createRoadmapItemAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function RoadmapAdminPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "roadmap", "view");
  const canCreate = can(ctx.role, "roadmap", "create");

  const [workspace, items] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { slug: true },
    }),
    prisma.roadmapItem.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ status: "asc" }, { position: "asc" }],
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        position: true,
        voteCount: true,
        isPublic: true,
      },
    }),
  ]);

  const grouped = groupItemsByStatus(items);
  const wsSlug = workspace?.slug ?? "";
  const publicUrl = `/roadmap/${wsSlug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground">
            Share what you're building. Public visitors can vote with their email.
          </p>
        </div>
        <Link href={publicUrl} target="_blank" rel="noreferrer">
          <Button>View public page</Button>
        </Link>
      </div>

      <Card className="p-4 text-sm">
        <span className="text-muted-foreground">Public URL: </span>
        <code className="rounded bg-muted px-1.5 py-0.5">{publicUrl}</code>
      </Card>

      {canCreate ? (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">New roadmap item</h2>
          <form action={createRoadmapItemAction} className="space-y-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={5000} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue="PLANNED">
                  {ROADMAP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatRoadmapStatus(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <input
                  id="isPublic"
                  name="isPublic"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />
                <Label htmlFor="isPublic" className="!mb-0">
                  Show on public page
                </Label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STATUSES.map((status) => (
          <ColumnCard key={status} status={status} items={grouped[status]} />
        ))}
      </div>
    </div>
  );
}

type ItemRow = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  position: number;
  voteCount: number;
  isPublic: boolean;
};

function ColumnCard({ status, items }: { status: RoadmapStatus; items: ItemRow[] }) {
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
        <Card className="p-4 text-xs text-muted-foreground">No items.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} href={`/app/roadmap/${it.id}`} className="block">
              <Card className="p-3 transition hover:border-foreground/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{it.title}</div>
                    {it.category ? (
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {it.category}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-semibold">{it.voteCount}</div>
                    <div className="text-[10px] text-muted-foreground">votes</div>
                  </div>
                </div>
                {!it.isPublic ? (
                  <p className="mt-2 text-[10px] uppercase text-amber-700">
                    Hidden from public
                  </p>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
