"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  chatSchema,
  generateAssistCode,
  sessionSchema,
} from "@/modules/assist/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

async function uniqueAssistCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generateAssistCode();
    const exists = await prisma.assistSession.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Unable to allocate Assist code, please retry");
}

export async function createSessionAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "create");

  const parsed = sessionSchema.parse({
    customerName: s(fd, "customerName"),
    customerEmail: s(fd, "customerEmail"),
    customerPhone: s(fd, "customerPhone"),
    topic: s(fd, "topic"),
  });

  const code = await uniqueAssistCode();
  const created = await prisma.assistSession.create({
    data: {
      workspaceId: ctx.workspaceId,
      technicianId: ctx.userId,
      code,
      customerName: parsed.customerName,
      customerEmail: parsed.customerEmail || null,
      customerPhone: parsed.customerPhone || null,
      topic: parsed.topic || null,
      events: {
        create: {
          kind: "CREATED",
          actorId: ctx.userId,
          body: `Session created by ${ctx.name || ctx.email}`,
        },
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assist.session.create",
    resource: "assistSession",
    resourceId: created.id,
    diff: { code, customerName: parsed.customerName },
  });

  revalidatePath("/app/assist");
  redirect(`/app/assist/${created.id}`);
}

async function loadSession(workspaceId: string, sessionId: string) {
  const sess = await prisma.assistSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { id: true, status: true, startedAt: true },
  });
  if (!sess) throw new Error("Assist session not found");
  return sess;
}

export async function startSessionAction(sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "edit");
  const sess = await loadSession(ctx.workspaceId, sessionId);
  if (sess.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.assistSession.update({
      where: { id: sessionId },
      data: { status: "ACTIVE", startedAt: new Date() },
    }),
    prisma.assistEvent.create({
      data: { sessionId, kind: "JOINED", actorId: ctx.userId },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assist.session.start",
    resource: "assistSession",
    resourceId: sessionId,
  });

  revalidatePath(`/app/assist/${sessionId}`);
}

export async function endSessionAction(sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "edit");
  const sess = await loadSession(ctx.workspaceId, sessionId);
  if (sess.status === "ENDED" || sess.status === "CANCELLED") return;

  const endedAt = new Date();
  const startedAt = sess.startedAt ?? endedAt;
  const durationSec = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );

  await prisma.$transaction([
    prisma.assistSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt, durationSec },
    }),
    prisma.assistEvent.create({
      data: { sessionId, kind: "ENDED", actorId: ctx.userId },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assist.session.end",
    resource: "assistSession",
    resourceId: sessionId,
    diff: { durationSec },
  });

  revalidatePath(`/app/assist/${sessionId}`);
}

export async function cancelSessionAction(sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "edit");
  const sess = await loadSession(ctx.workspaceId, sessionId);
  if (sess.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.assistSession.update({
      where: { id: sessionId },
      data: { status: "CANCELLED", endedAt: new Date() },
    }),
    prisma.assistEvent.create({
      data: { sessionId, kind: "ENDED", actorId: ctx.userId, body: "Cancelled" },
    }),
  ]);

  revalidatePath(`/app/assist/${sessionId}`);
}

export async function postChatAction(sessionId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "edit");
  await loadSession(ctx.workspaceId, sessionId);

  const parsed = chatSchema.parse({ body: s(fd, "body") });

  await prisma.assistEvent.create({
    data: {
      sessionId,
      kind: "CHAT",
      actorId: ctx.userId,
      body: parsed.body,
    },
  });

  revalidatePath(`/app/assist/${sessionId}`);
}

export async function grantControlAction(sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "edit");
  await loadSession(ctx.workspaceId, sessionId);

  await prisma.assistEvent.create({
    data: { sessionId, kind: "CONTROL_GRANTED", actorId: ctx.userId },
  });

  revalidatePath(`/app/assist/${sessionId}`);
}

export async function deleteSessionAction(sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "delete");

  const sess = await prisma.assistSession.findFirst({
    where: { id: sessionId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!sess) throw new Error("Assist session not found");

  await prisma.assistSession.delete({ where: { id: sessionId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assist.session.delete",
    resource: "assistSession",
    resourceId: sessionId,
  });

  revalidatePath("/app/assist");
  redirect("/app/assist");
}
