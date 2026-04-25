"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import {
  ticketSchema,
  ticketStatusSchema,
  ticketMessageSchema,
} from "@/modules/helpdesk/schemas";

function fdToObj(fd: FormData) {
  return {
    subject: fd.get("subject") ?? "",
    description: fd.get("description") ?? "",
    status: (fd.get("status") as string) || "OPEN",
    priority: (fd.get("priority") as string) || "MEDIUM",
    requesterContactId: fd.get("requesterContactId") ?? "",
    assigneeId: fd.get("assigneeId") ?? "",
    channel: (fd.get("channel") as string) || "web",
    tags: fd.get("tags") ?? "",
    firstResponseAt: fd.get("firstResponseAt") ?? "",
    resolvedAt: fd.get("resolvedAt") ?? "",
  };
}

async function nextTicketNumber(workspaceId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({
    where: { workspaceId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function createTicketAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ticket", "create");
  const parsed = ticketSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  let ticketId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = await nextTicketNumber(ctx.workspaceId);
    try {
      const ticket = await prisma.ticket.create({
        data: {
          workspaceId: ctx.workspaceId,
          number,
          subject: data.subject,
          description: data.description,
          status: data.status,
          priority: data.priority,
          requesterContactId: data.requesterContactId,
          assigneeId: data.assigneeId,
          channel: data.channel,
          tags: data.tags,
          firstResponseAt: data.firstResponseAt ?? null,
          resolvedAt: data.resolvedAt ?? null,
        },
      });
      ticketId = ticket.id;
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  if (!ticketId) return { error: "Could not allocate ticket number" };

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "ticket",
      resourceId: ticketId,
    },
  });
  revalidatePath("/app/helpdesk/tickets");
  redirect(`/app/helpdesk/tickets/${ticketId}`);
}

export async function updateTicketAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ticket", "edit");
  const parsed = ticketSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const existing = await prisma.ticket.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.ticket.update({
    where: { id },
    data: {
      subject: data.subject,
      description: data.description,
      status: data.status,
      priority: data.priority,
      requesterContactId: data.requesterContactId,
      assigneeId: data.assigneeId,
      channel: data.channel,
      tags: data.tags,
      firstResponseAt: data.firstResponseAt ?? null,
      resolvedAt: data.resolvedAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "ticket",
      resourceId: id,
    },
  });
  revalidatePath(`/app/helpdesk/tickets/${id}`);
  revalidatePath("/app/helpdesk/tickets");
  return { ok: true };
}

export async function setTicketStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ticket", "edit");
  const parsed = ticketStatusSchema.safeParse({ status: fd.get("status") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  const existing = await prisma.ticket.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, resolvedAt: true },
  });
  if (!existing) return { error: "Not found" };
  const next = parsed.data.status;
  await prisma.ticket.update({
    where: { id },
    data: {
      status: next,
      resolvedAt:
        (next === TicketStatus.RESOLVED || next === TicketStatus.CLOSED) && !existing.resolvedAt
          ? new Date()
          : next === TicketStatus.OPEN || next === TicketStatus.PENDING
          ? null
          : existing.resolvedAt,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: `status:${next.toLowerCase()}`,
      resource: "ticket",
      resourceId: id,
      diff: { from: existing.status, to: next },
    },
  });
  revalidatePath(`/app/helpdesk/tickets/${id}`);
  revalidatePath("/app/helpdesk/tickets");
  return { ok: true };
}

export async function addTicketMessageAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ticket", "edit");
  const parsed = ticketMessageSchema.safeParse({
    body: fd.get("body") ?? "",
    isInternal: fd.get("isInternal"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ticket = await prisma.ticket.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, firstResponseAt: true },
  });
  if (!ticket) return { error: "Not found" };

  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorType: "agent",
        authorId: ctx.userId,
        body: parsed.data.body,
        isInternal: parsed.data.isInternal,
      },
    });
    if (!ticket.firstResponseAt && !parsed.data.isInternal) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { firstResponseAt: new Date() },
      });
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: parsed.data.isInternal ? "note" : "reply",
      resource: "ticket",
      resourceId: ticket.id,
    },
  });
  revalidatePath(`/app/helpdesk/tickets/${ticket.id}`);
  return { ok: true };
}

export async function deleteTicketAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ticket", "delete");
  const existing = await prisma.ticket.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.ticket.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "ticket",
      resourceId: id,
    },
  });
  revalidatePath("/app/helpdesk/tickets");
  redirect("/app/helpdesk/tickets");
}
