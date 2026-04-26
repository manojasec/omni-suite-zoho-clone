import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_LABELS,
  formatDateTime,
} from "@/modules/slides/schemas";
import { updateSlideAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function SlideEditorPage({
  params,
}: {
  params: Promise<{ id: string; slideId: string }>;
}) {
  const { id, slideId } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "view");

  const slide = await prisma.slide.findFirst({
    where: {
      id: slideId,
      presentationId: id,
      presentation: { workspaceId: ctx.workspaceId },
    },
    include: {
      presentation: { select: { id: true, title: true } },
    },
  });
  if (!slide) notFound();

  const canEdit = can(ctx.role, "presentation", "edit");
  const total = await prisma.slide.count({
    where: { presentationId: id },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Slide {slide.position + 1} of {total}
          </h1>
          <p className="text-sm text-muted-foreground">
            {slide.presentation.title} · {SLIDE_LAYOUT_LABELS[slide.layout]} ·
            updated {formatDateTime(slide.updatedAt)}
          </p>
        </div>
        <Link
          href={`/app/slides/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to deck
        </Link>
      </div>

      <Card className="p-4">
        {canEdit ? (
          <form
            action={updateSlideAction.bind(null, slide.id)}
            className="grid gap-3"
          >
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={slide.title}
                required
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="layout">Layout</Label>
              <Select
                id="layout"
                name="layout"
                defaultValue={slide.layout}
              >
                {SLIDE_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {SLIDE_LAYOUT_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                name="body"
                defaultValue={slide.body}
                rows={12}
                maxLength={20_000}
              />
            </div>
            <div>
              <Label htmlFor="notes">Speaker notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={slide.notes ?? ""}
                rows={4}
                maxLength={5_000}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{slide.title}</h2>
            <article className="whitespace-pre-wrap text-sm leading-6">
              {slide.body || (
                <span className="text-muted-foreground">No body yet.</span>
              )}
            </article>
            {slide.notes ? (
              <div className="mt-2 rounded bg-muted/40 p-3 text-xs">
                <div className="mb-1 font-medium">Speaker notes</div>
                <div className="whitespace-pre-wrap">{slide.notes}</div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}
