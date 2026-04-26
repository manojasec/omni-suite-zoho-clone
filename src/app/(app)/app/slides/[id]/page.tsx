import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  PRESENTATION_STATUS_LABELS,
  PRESENTATION_TRANSITIONS,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_LABELS,
  formatDateTime,
} from "@/modules/slides/schemas";
import {
  createSlideAction,
  deletePresentationAction,
  deleteSlideAction,
  moveSlideAction,
  transitionPresentationAction,
  updatePresentationAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function PresentationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "view");

  const deck = await prisma.presentation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      slides: { orderBy: { position: "asc" } },
    },
  });
  if (!deck) notFound();

  const canEdit = can(ctx.role, "presentation", "edit");
  const canDelete = can(ctx.role, "presentation", "delete");
  const transitions = PRESENTATION_TRANSITIONS[deck.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {deck.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {deck.slides.length} slide{deck.slides.length === 1 ? "" : "s"} ·
            updated {formatDateTime(deck.updatedAt)}
            {deck.publishedAt
              ? ` · published ${formatDateTime(deck.publishedAt)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[deck.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {PRESENTATION_STATUS_LABELS[deck.status]}
          </span>
          {canEdit
            ? transitions.map((t) => (
                <form
                  key={t}
                  action={transitionPresentationAction.bind(null, deck.id)}
                >
                  <input type="hidden" name="status" value={t} />
                  <Button type="submit" size="sm" variant="outline">
                    {t === "PUBLISHED"
                      ? "Publish"
                      : t === "ARCHIVED"
                        ? "Archive"
                        : "Move to draft"}
                  </Button>
                </form>
              ))
            : null}
          {canDelete && deck.status !== "PUBLISHED" ? (
            <form action={deletePresentationAction.bind(null, deck.id)}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
          <Link
            href="/app/slides"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      {canEdit ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Deck details</h2>
          <form
            action={updatePresentationAction.bind(null, deck.id)}
            className="grid gap-3"
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={deck.title}
                required
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={deck.description ?? ""}
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <Card className="divide-y">
          {deck.slides.map((s, idx) => (
            <div
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-3 p-3"
            >
              <Link
                href={`/app/slides/${deck.id}/${s.id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <div className="text-xs text-muted-foreground">
                  Slide {idx + 1} · {SLIDE_LAYOUT_LABELS[s.layout]}
                </div>
                <div className="text-sm font-medium">{s.title}</div>
                {s.body ? (
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {s.body.slice(0, 200)}
                  </div>
                ) : null}
              </Link>
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-1">
                  <form action={moveSlideAction.bind(null, s.id)}>
                    <input type="hidden" name="direction" value="up" />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={idx === 0}
                    >
                      ↑
                    </Button>
                  </form>
                  <form action={moveSlideAction.bind(null, s.id)}>
                    <input type="hidden" name="direction" value="down" />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={idx === deck.slides.length - 1}
                    >
                      ↓
                    </Button>
                  </form>
                  {deck.slides.length > 1 ? (
                    <form action={deleteSlideAction.bind(null, s.id)}>
                      <Button type="submit" size="sm" variant="outline">
                        Delete
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </Card>

        {canEdit ? (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Add slide</h2>
            <form
              action={createSlideAction.bind(null, deck.id)}
              className="grid gap-3"
            >
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="layout">Layout</Label>
                <Select id="layout" name="layout" defaultValue="CONTENT">
                  {SLIDE_LAYOUTS.map((l) => (
                    <option key={l} value={l}>
                      {SLIDE_LAYOUT_LABELS[l]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" name="body" rows={4} maxLength={20_000} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
