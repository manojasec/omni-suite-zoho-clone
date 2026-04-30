"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  roadmapItemSchema,
  voteEmailSchema,
} from "@/modules/roadmap/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createRoadmapItemAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "roadmap", "create");

  const parsed = roadmapItemSchema.safeParse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    category: s(fd, "category"),
    status: s(fd, "status") || "PLANNED",
    isPublic: s(fd, "isPublic") === "on" || s(fd, "isPublic") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const last = await prisma.roadmapItem.findFirst({
    where: { workspaceId: ctx.workspaceId, status: parsed.data.status },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.roadmapItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      status: parsed.data.status,
      isPublic: parsed.data.isPublic,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "roadmap.item.create",
    resource: "roadmapItem",
    resourceId: created.id,
    diff: { title: parsed.data.title, status: parsed.data.status },
  });

  revalidatePath("/app/roadmap");
  redirect(`/app/roadmap/${created.id}`);
}

export async function updateRoadmapItemAction(itemId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "roadmap", "edit");

  const existing = await prisma.roadmapItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Item not found");

  const parsed = roadmapItemSchema.safeParse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    category: s(fd, "category"),
    status: s(fd, "status") || existing.status,
    isPublic: s(fd, "isPublic") === "on" || s(fd, "isPublic") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await prisma.roadmapItem.update({
    where: { id: itemId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      status: parsed.data.status,
      isPublic: parsed.data.isPublic,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "roadmap.item.update",
    resource: "roadmapItem",
    resourceId: itemId,
    diff: { from: existing.status, to: parsed.data.status },
  });

  revalidatePath("/app/roadmap");
  revalidatePath(`/app/roadmap/${itemId}`);
}

export async function deleteRoadmapItemAction(itemId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "roadmap", "delete");

  const existing = await prisma.roadmapItem.findFirst({
    where: { id: itemId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Item not found");

  await prisma.roadmapItem.delete({ where: { id: itemId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "roadmap.item.delete",
    resource: "roadmapItem",
    resourceId: itemId,
  });

  revalidatePath("/app/roadmap");
  redirect("/app/roadmap");
}

/** Public action — invoked from the public roadmap page. No auth required. */
export async function voteRoadmapItemAction(
  workspaceId: string,
  itemId: string,
  fd: FormData,
) {
  const emailParsed = voteEmailSchema.safeParse(s(fd, "email"));
  if (!emailParsed.success) throw new Error("Enter a valid email to vote");

  const item = await prisma.roadmapItem.findFirst({
    where: { id: itemId, workspaceId, isPublic: true },
    select: { id: true, status: true },
  });
  if (!item) throw new Error("Item not found");
  if (item.status === "SHIPPED") throw new Error("Voting is closed for shipped items");

  // Idempotent: do not throw on duplicate; just no-op.
  const existingVote = await prisma.roadmapVote.findUnique({
    where: { itemId_voterEmail: { itemId, voterEmail: emailParsed.data } },
    select: { id: true },
  });
  if (existingVote) {
    revalidatePath(`/roadmap`);
    return;
  }

  await prisma.$transaction([
    prisma.roadmapVote.create({
      data: { workspaceId, itemId, voterEmail: emailParsed.data },
    }),
    prisma.roadmapItem.update({
      where: { id: itemId },
      data: { voteCount: { increment: 1 } },
    }),
  ]);

  await recordAuditEvent({
    workspaceId,
    actorId: null,
    action: "roadmap.item.vote",
    resource: "roadmapItem",
    resourceId: itemId,
    diff: { email: emailParsed.data },
  });

  revalidatePath(`/roadmap`);
}
