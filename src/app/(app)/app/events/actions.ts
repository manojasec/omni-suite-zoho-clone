"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  eventSchema,
  eventSessionSchema,
  registrationSchema,
  generateTicketCode,
  slugify,
} from "@/modules/events/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------- Events ----------

export async function createEventAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "create");
  const titleRaw = s(fd, "title");
  const slugRaw = s(fd, "slug") || slugify(titleRaw);
  const parsed = eventSchema.safeParse({
    title: titleRaw,
    slug: slugRaw,
    summary: s(fd, "summary"),
    description: s(fd, "description"),
    location: s(fd, "location"),
    isVirtual: fd.get("isVirtual"),
    meetingUrl: s(fd, "meetingUrl"),
    status: s(fd, "status") || "DRAFT",
    startsAt: s(fd, "startsAt"),
    endsAt: s(fd, "endsAt"),
    capacity: s(fd, "capacity"),
    coverImageUrl: s(fd, "coverImageUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  let event;
  try {
    event = await prisma.event.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        title: parsed.data.title,
        slug: parsed.data.slug.toLowerCase(),
        summary: parsed.data.summary ?? null,
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
        isVirtual: parsed.data.isVirtual,
        meetingUrl: parsed.data.meetingUrl ?? null,
        status: parsed.data.status,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        capacity: parsed.data.capacity ?? null,
        coverImageUrl: parsed.data.coverImageUrl ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Slug already in use for this workspace");
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "event",
    resourceId: event.id,
    diff: { title: event.title, slug: event.slug },
  });
  redirect(`/app/events/${event.id}`);
}

export async function updateEventAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "edit");
  const existing = await prisma.event.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Event not found");
  const parsed = eventSchema.safeParse({
    title: s(fd, "title"),
    slug: s(fd, "slug"),
    summary: s(fd, "summary"),
    description: s(fd, "description"),
    location: s(fd, "location"),
    isVirtual: fd.get("isVirtual"),
    meetingUrl: s(fd, "meetingUrl"),
    status: s(fd, "status") || "DRAFT",
    startsAt: s(fd, "startsAt"),
    endsAt: s(fd, "endsAt"),
    capacity: s(fd, "capacity"),
    coverImageUrl: s(fd, "coverImageUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  try {
    await prisma.event.update({
      where: { id },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug.toLowerCase(),
        summary: parsed.data.summary ?? null,
        description: parsed.data.description ?? null,
        location: parsed.data.location ?? null,
        isVirtual: parsed.data.isVirtual,
        meetingUrl: parsed.data.meetingUrl ?? null,
        status: parsed.data.status,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        capacity: parsed.data.capacity ?? null,
        coverImageUrl: parsed.data.coverImageUrl ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Slug already in use for this workspace");
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "event",
    resourceId: id,
    diff: { title: parsed.data.title },
  });
  revalidatePath(`/app/events/${id}`);
  revalidatePath("/app/events");
}

export async function deleteEventAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "delete");
  const existing = await prisma.event.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Event not found");
  await prisma.event.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "event",
    resourceId: id,
    diff: { title: existing.title },
  });
  redirect("/app/events");
}

// ---------- Sessions ----------

export async function createEventSessionAction(eventId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "edit");
  const event = await prisma.event.findFirst({ where: { id: eventId, workspaceId: ctx.workspaceId } });
  if (!event) throw new Error("Event not found");
  const parsed = eventSessionSchema.safeParse({
    title: s(fd, "title"),
    speaker: s(fd, "speaker"),
    location: s(fd, "location"),
    startsAt: s(fd, "startsAt"),
    endsAt: s(fd, "endsAt"),
    notes: s(fd, "notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.eventSession.create({
    data: {
      eventId,
      title: parsed.data.title,
      speaker: parsed.data.speaker ?? null,
      location: parsed.data.location ?? null,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      notes: parsed.data.notes ?? null,
    },
  });
  revalidatePath(`/app/events/${eventId}`);
}

export async function deleteEventSessionAction(eventId: string, sessionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "edit");
  const session = await prisma.eventSession.findFirst({
    where: { id: sessionId, event: { workspaceId: ctx.workspaceId } },
  });
  if (!session) throw new Error("Session not found");
  await prisma.eventSession.delete({ where: { id: sessionId } });
  revalidatePath(`/app/events/${eventId}`);
}

// ---------- Registrations (admin) ----------

export async function updateRegistrationStatusAction(
  eventId: string,
  registrationId: string,
  status: "REGISTERED" | "CONFIRMED" | "ATTENDED" | "CANCELLED" | "WAITLISTED",
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "eventRegistration", "edit");
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, event: { workspaceId: ctx.workspaceId } },
  });
  if (!reg) throw new Error("Registration not found");
  await prisma.eventRegistration.update({
    where: { id: registrationId },
    data: {
      status,
      checkedInAt: status === "ATTENDED" ? (reg.checkedInAt ?? new Date()) : reg.checkedInAt,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "eventRegistration",
    resourceId: registrationId,
    diff: { status },
  });
  revalidatePath(`/app/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}/registrations`);
}

export async function deleteRegistrationAction(eventId: string, registrationId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "eventRegistration", "delete");
  const reg = await prisma.eventRegistration.findFirst({
    where: { id: registrationId, event: { workspaceId: ctx.workspaceId } },
  });
  if (!reg) throw new Error("Registration not found");
  await prisma.eventRegistration.delete({ where: { id: registrationId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "eventRegistration",
    resourceId: registrationId,
    diff: { email: reg.email },
  });
  revalidatePath(`/app/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}/registrations`);
}

// ---------- Public registration ----------

export async function publicRegisterAction(slug: string, fd: FormData) {
  const parsed = registrationSchema.safeParse({
    name: s(fd, "name"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    company: s(fd, "company"),
    notes: s(fd, "notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const event = await prisma.event.findFirst({
    where: { slug: slug.toLowerCase(), status: "PUBLISHED" },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) throw new Error("Event not available");

  // Detect existing registration before insert.
  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_email: { eventId: event.id, email: parsed.data.email.toLowerCase() } },
  });
  if (existing) {
    redirect(`/e/${slug}/registered?code=${encodeURIComponent(existing.ticketCode)}`);
  }

  // Honor capacity by waitlisting if full.
  const status =
    event.capacity != null && event._count.registrations >= event.capacity
      ? "WAITLISTED"
      : "REGISTERED";

  const ticketCode = generateTicketCode();
  await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone ?? null,
      company: parsed.data.company ?? null,
      notes: parsed.data.notes ?? null,
      status,
      ticketCode,
    },
  });
  revalidatePath(`/app/events/${event.id}`);
  redirect(`/e/${slug}/registered?code=${encodeURIComponent(ticketCode)}`);
}

export async function checkInByCodeAction(eventId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "eventRegistration", "edit");
  const code = s(fd, "code").trim().toUpperCase();
  if (!code) throw new Error("Ticket code required");
  const reg = await prisma.eventRegistration.findFirst({
    where: { eventId, ticketCode: code, event: { workspaceId: ctx.workspaceId } },
  });
  if (!reg) throw new Error("No registration matches that ticket code");
  await prisma.eventRegistration.update({
    where: { id: reg.id },
    data: { status: "ATTENDED", checkedInAt: reg.checkedInAt ?? new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "eventRegistration",
    resourceId: reg.id,
    diff: { checkin: true },
  });
  revalidatePath(`/app/events/${eventId}`);
  revalidatePath(`/app/events/${eventId}/registrations`);
}
