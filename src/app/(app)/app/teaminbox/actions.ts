"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { assertWithinRateLimit } from "@/platform/throttle";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  inboxSchema,
  replySchema,
  threadSchema,
} from "@/modules/teaminbox/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createInboxAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "create");

  const parsed = inboxSchema.parse({
    name: s(fd, "name"),
    address: s(fd, "address"),
  });

  const created = await prisma.sharedInbox.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.name,
      address: parsed.address,
      members: { create: { userId: ctx.userId } },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "teaminbox.inbox.create",
    resource: "sharedInbox",
    resourceId: created.id,
    diff: { name: parsed.name, address: parsed.address },
  });

  revalidatePath("/app/teaminbox");
  redirect(`/app/teaminbox/${created.id}`);
}

export async function createThreadAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "edit");

  const parsed = threadSchema.parse({
    inboxId: s(fd, "inboxId"),
    fromName: s(fd, "fromName"),
    fromEmail: s(fd, "fromEmail"),
    subject: s(fd, "subject"),
    body: s(fd, "body"),
  });

  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: parsed.inboxId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!inbox) throw new Error("Inbox not found");

  const thread = await prisma.sharedThread.create({
    data: {
      inboxId: parsed.inboxId,
      workspaceId: ctx.workspaceId,
      subject: parsed.subject,
      fromName: parsed.fromName,
      fromEmail: parsed.fromEmail,
      messages: {
        create: {
          direction: "IN",
          authorName: parsed.fromName,
          body: parsed.body,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath(`/app/teaminbox/${parsed.inboxId}`);
  redirect(`/app/teaminbox/${parsed.inboxId}/${thread.id}`);
}

async function loadThread(workspaceId: string, threadId: string) {
  const t = await prisma.sharedThread.findFirst({
    where: { id: threadId, workspaceId },
    select: { id: true, inboxId: true, status: true },
  });
  if (!t) throw new Error("Thread not found");
  return t;
}

export async function postReplyAction(threadId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "edit");
  assertWithinRateLimit({ feature: "teaminbox.reply", userId: ctx.userId, limit: 30 });
  const t = await loadThread(ctx.workspaceId, threadId);

  const parsed = replySchema.parse({
    body: s(fd, "body"),
    direction: s(fd, "direction") || "OUT",
  });

  await prisma.$transaction([
    prisma.sharedMessage.create({
      data: {
        threadId,
        direction: parsed.direction,
        authorId: ctx.userId,
        authorName: ctx.name || ctx.email,
        body: parsed.body,
      },
    }),
    prisma.sharedThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  revalidatePath(`/app/teaminbox/${t.inboxId}/${threadId}`);
}

export async function setThreadStatusAction(
  threadId: string,
  status: "OPEN" | "PENDING" | "CLOSED",
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "edit");
  const t = await loadThread(ctx.workspaceId, threadId);

  await prisma.sharedThread.update({
    where: { id: threadId },
    data: { status },
  });

  revalidatePath(`/app/teaminbox/${t.inboxId}/${threadId}`);
}

export async function assignThreadAction(threadId: string, userId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "edit");
  const t = await loadThread(ctx.workspaceId, threadId);

  await prisma.sharedThread.update({
    where: { id: threadId },
    data: { assignedToId: userId || null },
  });

  revalidatePath(`/app/teaminbox/${t.inboxId}/${threadId}`);
}
