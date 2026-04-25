"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  composeMailSchema,
  makeSnippet,
  moveMailSchema,
  parseAddressList,
  replyMailSchema,
} from "@/modules/mail/schemas";

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Compose new thread ----------------

export async function composeMailAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailMessage", "send");

  const parsed = composeMailSchema.safeParse({
    to: fdString(fd, "to"),
    cc: fdString(fd, "cc"),
    bcc: fdString(fd, "bcc"),
    subject: fdString(fd, "subject"),
    body: fdString(fd, "body"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const to = parseAddressList(parsed.data.to);
  const cc = parseAddressList(parsed.data.cc);
  const bcc = parseAddressList(parsed.data.bcc);

  const fromAddress = ctx.email;
  const fromName = ctx.name ?? null;

  const now = new Date();
  const thread = await prisma.mailThread.create({
    data: {
      workspaceId: ctx.workspaceId,
      subject: parsed.data.subject,
      snippet: makeSnippet(parsed.data.body),
      participants: Array.from(new Set([fromAddress, ...to, ...cc, ...bcc])),
      folder: "SENT",
      isUnread: false,
      lastMessageAt: now,
      messages: {
        create: {
          workspaceId: ctx.workspaceId,
          direction: "OUTBOUND",
          fromAddress,
          fromName,
          toAddresses: to,
          ccAddresses: cc,
          bccAddresses: bcc,
          subject: parsed.data.subject,
          body: parsed.data.body,
          sentByUserId: ctx.userId,
        },
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "send",
    resource: "mailMessage",
    resourceId: thread.id,
    diff: { to, subject: parsed.data.subject },
  });

  redirect(`/app/mail/${thread.id}`);
}

// ---------------- Reply on existing thread ----------------

export async function replyMailAction(threadId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailMessage", "send");

  const parsed = replyMailSchema.safeParse({ body: fdString(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const thread = await prisma.mailThread.findFirst({
    where: { id: threadId, workspaceId: ctx.workspaceId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!thread) throw new Error("Thread not found");

  const last = thread.messages[0];
  // Recipients of a reply: the last message's sender + its To minus our own address.
  const to: string[] = [];
  if (last) {
    if (last.fromAddress && last.fromAddress.toLowerCase() !== ctx.email.toLowerCase()) {
      to.push(last.fromAddress);
    }
    const lastTo = Array.isArray(last.toAddresses) ? (last.toAddresses as unknown[]) : [];
    for (const addr of lastTo) {
      if (typeof addr !== "string") continue;
      if (addr.toLowerCase() === ctx.email.toLowerCase()) continue;
      if (!to.includes(addr)) to.push(addr);
    }
  }

  const subject = thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`;
  const now = new Date();

  await prisma.$transaction([
    prisma.mailMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        threadId: thread.id,
        direction: "OUTBOUND",
        fromAddress: ctx.email,
        fromName: ctx.name ?? null,
        toAddresses: to,
        ccAddresses: [],
        bccAddresses: [],
        subject,
        body: parsed.data.body,
        sentByUserId: ctx.userId,
      },
    }),
    prisma.mailThread.update({
      where: { id: thread.id },
      data: {
        snippet: makeSnippet(parsed.data.body),
        lastMessageAt: now,
        // Sending a reply also takes it out of TRASH/ARCHIVE.
        folder: thread.folder === "TRASH" || thread.folder === "ARCHIVE" ? "SENT" : thread.folder,
        isUnread: false,
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "send",
    resource: "mailMessage",
    resourceId: thread.id,
    diff: { reply: true },
  });
  revalidatePath(`/app/mail/${threadId}`);
  revalidatePath("/app/mail");
}

// ---------------- Thread management ----------------

async function findThread(ctx: { workspaceId: string }, id: string) {
  const t = await prisma.mailThread.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!t) throw new Error("Thread not found");
  return t;
}

export async function moveThreadAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "edit");

  const parsed = moveMailSchema.safeParse({ folder: fdString(fd, "folder") });
  if (!parsed.success) throw new Error("Invalid folder");

  const t = await findThread(ctx, id);
  await prisma.mailThread.update({
    where: { id },
    data: { folder: parsed.data.folder },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "mailThread",
    resourceId: id,
    diff: { folder: { from: t.folder, to: parsed.data.folder } },
  });
  revalidatePath(`/app/mail/${id}`);
  revalidatePath("/app/mail");
}

export async function toggleStarThreadAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "edit");

  const t = await findThread(ctx, id);
  await prisma.mailThread.update({
    where: { id },
    data: { isStarred: !t.isStarred },
  });
  revalidatePath(`/app/mail/${id}`);
  revalidatePath("/app/mail");
}

export async function toggleReadThreadAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "edit");

  const t = await findThread(ctx, id);
  await prisma.mailThread.update({
    where: { id },
    data: { isUnread: !t.isUnread },
  });
  revalidatePath(`/app/mail/${id}`);
  revalidatePath("/app/mail");
}

export async function markThreadReadAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "view");

  await prisma.mailThread.updateMany({
    where: { id, workspaceId: ctx.workspaceId, isUnread: true },
    data: { isUnread: false },
  });
  revalidatePath(`/app/mail/${id}`);
  revalidatePath("/app/mail");
}

export async function deleteThreadAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "delete");

  const t = await findThread(ctx, id);
  await prisma.mailThread.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "mailThread",
    resourceId: id,
    diff: { subject: t.subject },
  });
  redirect("/app/mail");
}

// ---------------- Demo helper: simulate inbound message ----------------

/**
 * Adds a simulated INBOUND message to the workspace inbox so the UI has
 * realistic content without an external mail integration. Server-only.
 */
export async function simulateInboundAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailThread", "create");

  const fromAddress = fdString(fd, "fromAddress").trim();
  const subject = fdString(fd, "subject").trim() || "Hello there";
  const body = fdString(fd, "body").trim() || "This is a simulated inbound message.";

  if (!fromAddress) throw new Error("Sender address is required");

  const now = new Date();
  await prisma.mailThread.create({
    data: {
      workspaceId: ctx.workspaceId,
      subject,
      snippet: makeSnippet(body),
      participants: [fromAddress, ctx.email],
      folder: "INBOX",
      isUnread: true,
      lastMessageAt: now,
      messages: {
        create: {
          workspaceId: ctx.workspaceId,
          direction: "INBOUND",
          fromAddress,
          fromName: null,
          toAddresses: [ctx.email],
          ccAddresses: [],
          bccAddresses: [],
          subject,
          body,
        },
      },
    },
  });
  revalidatePath("/app/mail");
}
