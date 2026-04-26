"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  canTransitionPresentation,
  nextSlidePosition,
  presentationSchema,
  slideSchema,
  type PresentationStatus,
} from "@/modules/slides/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadPresentation(id: string, workspaceId: string) {
  return prisma.presentation.findFirst({ where: { id, workspaceId } });
}

async function loadSlide(slideId: string, workspaceId: string) {
  return prisma.slide.findFirst({
    where: { id: slideId, presentation: { workspaceId } },
    include: { presentation: { select: { id: true, workspaceId: true } } },
  });
}

export async function createPresentationAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "create");
  const data = presentationSchema.parse(toFormObject(fd));

  const p = await prisma.presentation.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: data.title,
      description: data.description || null,
      authorId: ctx.userId,
      slides: {
        create: {
          position: 0,
          layout: "TITLE",
          title: data.title,
          body: "",
        },
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "presentation",
    resourceId: p.id,
    diff: { title: p.title },
  });

  revalidatePath("/app/slides");
  redirect(`/app/slides/${p.id}`);
}

export async function updatePresentationAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const p = await loadPresentation(id, ctx.workspaceId);
  if (!p) throw new Error("Presentation not found");
  const data = presentationSchema.parse(toFormObject(fd));

  await prisma.presentation.update({
    where: { id },
    data: { title: data.title, description: data.description || null },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "presentation",
    resourceId: id,
    diff: { title: data.title },
  });

  revalidatePath(`/app/slides/${id}`);
  revalidatePath("/app/slides");
}

export async function transitionPresentationAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const p = await loadPresentation(id, ctx.workspaceId);
  if (!p) throw new Error("Presentation not found");
  const target = String(fd.get("status") ?? "") as PresentationStatus;
  if (!canTransitionPresentation(p.status, target)) {
    throw new Error(`Cannot transition from ${p.status} to ${target}`);
  }

  await prisma.presentation.update({
    where: { id },
    data: {
      status: target,
      publishedAt:
        target === "PUBLISHED" && !p.publishedAt ? new Date() : undefined,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "transition",
    resource: "presentation",
    resourceId: id,
    diff: { from: p.status, to: target },
  });

  revalidatePath(`/app/slides/${id}`);
  revalidatePath("/app/slides");
}

export async function deletePresentationAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "delete");
  const p = await loadPresentation(id, ctx.workspaceId);
  if (!p) throw new Error("Presentation not found");
  if (p.status === "PUBLISHED") {
    throw new Error("Archive before deleting a published presentation");
  }

  await prisma.presentation.delete({ where: { id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "presentation",
    resourceId: id,
    diff: { title: p.title },
  });

  revalidatePath("/app/slides");
  redirect("/app/slides");
}

export async function createSlideAction(presentationId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const p = await loadPresentation(presentationId, ctx.workspaceId);
  if (!p) throw new Error("Presentation not found");
  const data = slideSchema.parse(toFormObject(fd));

  const existing = await prisma.slide.findMany({
    where: { presentationId },
    select: { position: true },
  });
  const position = nextSlidePosition(existing);

  const s = await prisma.slide.create({
    data: {
      presentationId,
      position,
      layout: data.layout,
      title: data.title,
      body: data.body ?? "",
      notes: data.notes || null,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "slide",
    resourceId: s.id,
    diff: { presentationId, title: data.title },
  });

  revalidatePath(`/app/slides/${presentationId}`);
}

export async function updateSlideAction(slideId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const slide = await loadSlide(slideId, ctx.workspaceId);
  if (!slide) throw new Error("Slide not found");
  const data = slideSchema.parse(toFormObject(fd));

  await prisma.slide.update({
    where: { id: slideId },
    data: {
      title: data.title,
      body: data.body ?? "",
      notes: data.notes || null,
      layout: data.layout,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "slide",
    resourceId: slideId,
    diff: { title: data.title, layout: data.layout },
  });

  revalidatePath(`/app/slides/${slide.presentationId}`);
  revalidatePath(`/app/slides/${slide.presentationId}/${slideId}`);
}

export async function moveSlideAction(slideId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const slide = await loadSlide(slideId, ctx.workspaceId);
  if (!slide) throw new Error("Slide not found");
  const direction = String(fd.get("direction") ?? "");
  if (direction !== "up" && direction !== "down") {
    throw new Error("Invalid direction");
  }

  const all = await prisma.slide.findMany({
    where: { presentationId: slide.presentationId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const idx = all.findIndex((s) => s.id === slideId);
  if (idx < 0) throw new Error("Slide not found in presentation");
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= all.length) return;

  const a = all[idx];
  const b = all[swapWith];
  await prisma.$transaction([
    prisma.slide.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.slide.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "move",
    resource: "slide",
    resourceId: slideId,
    diff: { direction },
  });

  revalidatePath(`/app/slides/${slide.presentationId}`);
}

export async function deleteSlideAction(slideId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "edit");
  const slide = await loadSlide(slideId, ctx.workspaceId);
  if (!slide) throw new Error("Slide not found");

  const remaining = await prisma.slide.count({
    where: { presentationId: slide.presentationId },
  });
  if (remaining <= 1) {
    throw new Error("Cannot delete the last slide");
  }

  await prisma.slide.delete({ where: { id: slideId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "slide",
    resourceId: slideId,
    diff: { presentationId: slide.presentationId },
  });

  revalidatePath(`/app/slides/${slide.presentationId}`);
}
