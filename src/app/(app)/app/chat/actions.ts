"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  assignChatSchema,
  canChatTransition,
  sendAgentMessageSchema,
  sendVisitorMessageSchema,
  startChatSchema,
  updateChatStatusSchema,
} from "@/modules/chat/schemas";

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Public visitor actions (no auth) ----------------

export async function startVisitorChatAction(workspaceSlug: string, fd: FormData) {
  const parsed = startChatSchema.safeParse({
    visitorName: fdString(fd, "visitorName"),
    visitorEmail: fdString(fd, "visitorEmail"),
    pageUrl: fdString(fd, "pageUrl"),
    message: fdString(fd, "message"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ws = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!ws) throw new Error("Workspace not found");

  const conv = await prisma.chatConversation.create({
    data: {
      workspaceId: ws.id,
      visitorName: parsed.data.visitorName,
      visitorEmail: parsed.data.visitorEmail,
      pageUrl: parsed.data.pageUrl,
      messages: {
        create: {
          workspaceId: ws.id,
          sender: "VISITOR",
          body: parsed.data.message,
        },
      },
    },
  });

  redirect(`/chat/${workspaceSlug}/${conv.publicId}`);
}

export async function sendVisitorMessageAction(
  workspaceSlug: string,
  publicId: string,
  fd: FormData,
) {
  const parsed = sendVisitorMessageSchema.safeParse({ body: fdString(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ws = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
  if (!ws) throw new Error("Workspace not found");

  const conv = await prisma.chatConversation.findFirst({
    where: { publicId, workspaceId: ws.id },
  });
  if (!conv) throw new Error("Conversation not found");
  if (conv.status === "CLOSED") throw new Error("This conversation is closed");

  const now = new Date();
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        workspaceId: ws.id,
        conversationId: conv.id,
        sender: "VISITOR",
        body: parsed.data.body,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: now,
        // Re-open if the visitor messages after resolution.
        status: conv.status === "RESOLVED" ? "OPEN" : conv.status,
      },
    }),
  ]);

  revalidatePath(`/chat/${workspaceSlug}/${publicId}`);
  revalidatePath(`/app/chat/${conv.id}`);
  revalidatePath("/app/chat");
}

// ---------------- Authenticated agent actions ----------------

export async function sendAgentMessageAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "chatMessage", "send");

  const parsed = sendAgentMessageSchema.safeParse({ body: fdString(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const conv = await prisma.chatConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!conv) throw new Error("Conversation not found");
  if (conv.status === "CLOSED") throw new Error("This conversation is closed");

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        conversationId: conv.id,
        sender: "AGENT",
        agentId: ctx.userId,
        body: parsed.data.body,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: new Date(),
        // First agent reply auto-assigns and moves to ASSIGNED.
        agentId: conv.agentId ?? ctx.userId,
        status: conv.status === "OPEN" ? "ASSIGNED" : conv.status,
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "chatMessage",
    resourceId: conv.id,
    diff: { sender: "AGENT" },
  });

  revalidatePath(`/app/chat/${id}`);
  revalidatePath("/app/chat");
}

export async function assignChatAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "chatConversation", "assign");

  const parsed = assignChatSchema.safeParse({ agentId: fdString(fd, "agentId") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const conv = await prisma.chatConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!conv) throw new Error("Conversation not found");

  if (parsed.data.agentId) {
    const member = await prisma.membership.findFirst({
      where: { userId: parsed.data.agentId, workspaceId: ctx.workspaceId, status: "ACTIVE" },
    });
    if (!member) throw new Error("That user is not an active member");
  }

  const updated = await prisma.chatConversation.update({
    where: { id: conv.id },
    data: {
      agentId: parsed.data.agentId,
      status: parsed.data.agentId ? "ASSIGNED" : conv.status === "ASSIGNED" ? "OPEN" : conv.status,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "chatConversation",
    resourceId: conv.id,
    diff: { agentId: { from: conv.agentId, to: updated.agentId } },
  });

  revalidatePath(`/app/chat/${id}`);
  revalidatePath("/app/chat");
}

export async function updateChatStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "chatConversation", "edit");

  const parsed = updateChatStatusSchema.safeParse({ status: fdString(fd, "status") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const conv = await prisma.chatConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!conv) throw new Error("Conversation not found");

  if (!canChatTransition(conv.status, parsed.data.status)) {
    throw new Error(`Cannot move from ${conv.status} to ${parsed.data.status}`);
  }

  const now = new Date();
  await prisma.chatConversation.update({
    where: { id: conv.id },
    data: {
      status: parsed.data.status,
      resolvedAt:
        parsed.data.status === "RESOLVED" && !conv.resolvedAt ? now : conv.resolvedAt,
      closedAt: parsed.data.status === "CLOSED" && !conv.closedAt ? now : conv.closedAt,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "chatConversation",
    resourceId: conv.id,
    diff: { status: { from: conv.status, to: parsed.data.status } },
  });

  revalidatePath(`/app/chat/${id}`);
  revalidatePath("/app/chat");
}

export async function deleteChatAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "chatConversation", "delete");

  const conv = await prisma.chatConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!conv) throw new Error("Conversation not found");

  await prisma.chatConversation.delete({ where: { id: conv.id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "chatConversation",
    resourceId: conv.id,
    diff: { status: conv.status },
  });

  redirect("/app/chat");
}
