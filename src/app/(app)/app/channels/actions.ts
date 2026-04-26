"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  channelSchema,
  messageSchema,
  normalizeChannelName,
} from "@/modules/team-channels/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function ensureMember(channelId: string, workspaceId: string, userId: string) {
  const channel = await prisma.teamChannel.findFirst({ where: { id: channelId, workspaceId } });
  if (!channel) throw new Error("Channel not found");
  if (channel.kind === "PRIVATE" || channel.kind === "DIRECT") {
    const m = await prisma.teamChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!m) throw new Error("You are not a member of this channel");
  }
  return channel;
}

export async function createChannelAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "create");
  const parsed = channelSchema.safeParse({
    name: normalizeChannelName(s(fd, "name")),
    topic: s(fd, "topic"),
    kind: s(fd, "kind") || "PUBLIC",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let channel;
  try {
    channel = await prisma.teamChannel.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        name: parsed.data.name,
        topic: parsed.data.topic ?? null,
        kind: parsed.data.kind,
        members: {
          create: { userId: ctx.userId, lastReadAt: new Date() },
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Channel name already in use");
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "teamChannel",
    resourceId: channel.id,
    diff: { name: channel.name, kind: channel.kind },
  });
  redirect(`/app/channels/${channel.id}`);
}

export async function archiveChannelAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "edit");
  const channel = await prisma.teamChannel.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!channel) throw new Error("Channel not found");
  await prisma.teamChannel.update({
    where: { id },
    data: { archived: !channel.archived },
  });
  revalidatePath("/app/channels");
  revalidatePath(`/app/channels/${id}`);
}

export async function deleteChannelAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "delete");
  const channel = await prisma.teamChannel.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!channel) throw new Error("Channel not found");
  await prisma.teamChannel.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "teamChannel",
    resourceId: id,
    diff: { name: channel.name },
  });
  redirect("/app/channels");
}

export async function joinChannelAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "view");
  const channel = await prisma.teamChannel.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!channel) throw new Error("Channel not found");
  if (channel.kind === "PRIVATE" || channel.kind === "DIRECT") {
    throw new Error("Cannot self-join a private channel");
  }
  await prisma.teamChannelMember.upsert({
    where: { channelId_userId: { channelId: id, userId: ctx.userId } },
    create: { channelId: id, userId: ctx.userId, lastReadAt: new Date() },
    update: {},
  });
  revalidatePath(`/app/channels/${id}`);
}

export async function leaveChannelAction(id: string) {
  const ctx = await requireSession();
  await prisma.teamChannelMember.deleteMany({
    where: { channelId: id, userId: ctx.userId, channel: { workspaceId: ctx.workspaceId } },
  });
  redirect("/app/channels");
}

export async function inviteMemberAction(channelId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "edit");
  const channel = await prisma.teamChannel.findFirst({ where: { id: channelId, workspaceId: ctx.workspaceId } });
  if (!channel) throw new Error("Channel not found");
  const userId = s(fd, "userId");
  if (!userId) throw new Error("Pick a workspace member");
  // Verify candidate is in the workspace.
  const membership = await prisma.membership.findFirst({
    where: { userId, workspaceId: ctx.workspaceId, status: "ACTIVE" },
  });
  if (!membership) throw new Error("User is not a member of this workspace");
  await prisma.teamChannelMember.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId },
    update: {},
  });
  revalidatePath(`/app/channels/${channelId}`);
}

export async function removeMemberAction(channelId: string, userId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "edit");
  const channel = await prisma.teamChannel.findFirst({ where: { id: channelId, workspaceId: ctx.workspaceId } });
  if (!channel) throw new Error("Channel not found");
  await prisma.teamChannelMember.deleteMany({ where: { channelId, userId } });
  revalidatePath(`/app/channels/${channelId}`);
}

export async function postMessageAction(channelId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamMessage", "create");
  await ensureMember(channelId, ctx.workspaceId, ctx.userId);
  const parsed = messageSchema.safeParse({ body: s(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.teamMessage.create({
    data: { channelId, authorId: ctx.userId, body: parsed.data.body },
  });
  await prisma.teamChannelMember.updateMany({
    where: { channelId, userId: ctx.userId },
    data: { lastReadAt: new Date() },
  });
  revalidatePath(`/app/channels/${channelId}`);
}

export async function deleteMessageAction(channelId: string, messageId: string) {
  const ctx = await requireSession();
  const message = await prisma.teamMessage.findFirst({
    where: { id: messageId, channel: { workspaceId: ctx.workspaceId } },
  });
  if (!message) throw new Error("Message not found");
  // Authors can always delete their own messages; otherwise need delete on teamMessage.
  if (message.authorId !== ctx.userId) {
    assertCan(ctx.role, "teamMessage", "delete");
  }
  await prisma.teamMessage.delete({ where: { id: messageId } });
  revalidatePath(`/app/channels/${channelId}`);
}

export async function markChannelReadAction(channelId: string) {
  const ctx = await requireSession();
  await prisma.teamChannelMember.updateMany({
    where: { channelId, userId: ctx.userId, channel: { workspaceId: ctx.workspaceId } },
    data: { lastReadAt: new Date() },
  });
  revalidatePath(`/app/channels/${channelId}`);
}
