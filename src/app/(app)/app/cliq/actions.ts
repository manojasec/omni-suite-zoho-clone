"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { assertWithinRateLimit } from "@/platform/throttle";
import { recordAuditEvent } from "@/modules/audit/record";
import { channelSchema, messageSchema } from "@/modules/cliq/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createChannelAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "create");

  const parsed = channelSchema.parse({
    name: s(fd, "name"),
    topic: s(fd, "topic"),
    kind: s(fd, "kind") || "PUBLIC",
  });

  const created = await prisma.channel.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.name,
      topic: parsed.topic || null,
      kind: parsed.kind,
      members: {
        create: {
          userId: ctx.userId,
          role: "ADMIN",
        },
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "channel.create",
    resource: "channel",
    resourceId: created.id,
    diff: { name: parsed.name, kind: parsed.kind },
  });

  revalidatePath("/app/cliq");
  redirect(`/app/cliq/${created.id}`);
}

async function loadChannel(workspaceId: string, channelId: string, userId: string) {
  const ch = await prisma.channel.findFirst({
    where: { id: channelId, workspaceId },
    select: { id: true, kind: true },
  });
  if (!ch) throw new Error("Channel not found");
  if (ch.kind === "PRIVATE" || ch.kind === "DM") {
    const membership = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { id: true },
    });
    if (!membership) throw new Error("Not a member of this channel");
  }
  return ch;
}

export async function joinChannelAction(channelId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "view");

  const ch = await prisma.channel.findFirst({
    where: { id: channelId, workspaceId: ctx.workspaceId, kind: "PUBLIC" },
    select: { id: true },
  });
  if (!ch) throw new Error("Channel not joinable");

  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: ctx.userId } },
    create: { channelId, userId: ctx.userId },
    update: {},
  });

  revalidatePath(`/app/cliq/${channelId}`);
}

export async function postMessageAction(channelId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "edit");
  assertWithinRateLimit({ feature: "cliq.message", userId: ctx.userId, limit: 60 });
  await loadChannel(ctx.workspaceId, channelId, ctx.userId);

  const parsed = messageSchema.parse({
    body: s(fd, "body"),
    parentId: s(fd, "parentId"),
  });

  await prisma.channelMessage.create({
    data: {
      channelId,
      authorId: ctx.userId,
      body: parsed.body,
      parentId: parsed.parentId || null,
    },
  });

  revalidatePath(`/app/cliq/${channelId}`);
}

export async function markChannelReadAction(channelId: string) {
  const ctx = await requireSession();
  await loadChannel(ctx.workspaceId, channelId, ctx.userId);

  await prisma.channelMember.update({
    where: { channelId_userId: { channelId, userId: ctx.userId } },
    data: { lastReadAt: new Date() },
  });
}

export async function deleteChannelAction(channelId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "delete");

  const existing = await prisma.channel.findFirst({
    where: { id: channelId, workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
  });
  if (!existing) throw new Error("Channel not found");

  await prisma.channel.delete({ where: { id: channelId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "channel.delete",
    resource: "channel",
    resourceId: channelId,
    diff: { name: existing.name },
  });

  revalidatePath("/app/cliq");
  redirect("/app/cliq");
}
