import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ROADMAP_STATUSES,
  formatRoadmapStatus,
  roadmapStatusColor,
  type RoadmapStatus,
} from "@/modules/roadmap/schemas";
import { deleteRoadmapItemAction, updateRoadmapItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RoadmapItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "roadmap", "view");
  const canEdit = can(ctx.role, "roadmap", "edit");
  const canDelete = can(ctx.role, "roadmap", "delete");

  const item = await prisma.roadmapItem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      votes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { voterEmail: true, createdAt: true },
      },
    },
  });
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/roadmap" className="text-xs text-muted-foreground hover:underline">
          ← Roadmap
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${roadmapStatusColor(item.status as RoadmapStatus)}`}
          >
            {formatRoadmapStatus(item.status as RoadmapStatus)}
          </span>
          <span className="text-sm text-muted-foreground">
            {item.voteCount} {item.voteCount === 1 ? "vote" : "votes"}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{item.title}</h1>
      </div>

      <Card className="p-4">
        <form action={updateRoadmapItemAction.bind(null, item.id)} className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={item.title}
              required
              maxLength={200}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={item.description ?? ""}
              rows={6}
              maxLength={5000}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                defaultValue={item.category ?? ""}
                maxLength={80}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                defaultValue={item.status}
                disabled={!canEdit}
              >
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
                defaultChecked={item.isPublic}
                disabled={!canEdit}
                className="h-4 w-4"
              />
              <Label htmlFor="isPublic" className="!mb-0">
                Show on public page
              </Label>
            </div>
          </div>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent votes</h2>
        {item.votes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No votes yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {item.votes.map((v, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{v.voterEmail}</span>
                <span className="text-xs text-muted-foreground">
                  {v.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canDelete ? (
        <Card className="p-4">
          <form action={deleteRoadmapItemAction.bind(null, item.id)}>
            <Button type="submit" variant="ghost">
              Delete item
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
