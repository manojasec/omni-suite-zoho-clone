"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import {
  bookingTypeSchema,
  cancelBookingSchema,
  publicBookingSchema,
  toMinutes,
} from "@/modules/bookings/schemas";
import { recordAuditEvent } from "@/modules/audit/record";
import { computeSlots, parseISODate } from "@/modules/bookings/slots";

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Authenticated: BookingType CRUD ----------------

export async function createBookingTypeAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bookingType", "create");

  const parsed = bookingTypeSchema.safeParse({
    name: fdString(fd, "name"),
    publicSlug: fdString(fd, "publicSlug"),
    description: fdString(fd, "description"),
    durationMins: fdString(fd, "durationMins"),
    bufferMins: fdString(fd, "bufferMins") || "0",
    color: fdString(fd, "color") || "#0F172A",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const slugTaken = await prisma.bookingType.findUnique({
    where: { publicSlug: parsed.data.publicSlug },
    select: { id: true },
  });
  if (slugTaken) throw new Error("That slug is already in use");

  const bt = await prisma.bookingType.create({
    data: {
      workspaceId: ctx.workspaceId,
      hostId: ctx.userId,
      name: parsed.data.name,
      publicSlug: parsed.data.publicSlug,
      description: parsed.data.description ?? null,
      durationMins: parsed.data.durationMins,
      bufferMins: parsed.data.bufferMins,
      color: parsed.data.color,
      // Default availability: Mon–Fri 09:00–17:00
      availability: {
        create: [1, 2, 3, 4, 5].map((dow) => ({
          dayOfWeek: dow,
          startMinutes: 9 * 60,
          endMinutes: 17 * 60,
        })),
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "bookingType",
    resourceId: bt.id,
  });
  revalidatePath("/app/bookings/types");
  redirect(`/app/bookings/types/${bt.id}`);
}

export async function updateBookingTypeAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bookingType", "edit");
  const existing = await prisma.bookingType.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking type not found");

  const parsed = bookingTypeSchema.safeParse({
    name: fdString(fd, "name"),
    publicSlug: fdString(fd, "publicSlug"),
    description: fdString(fd, "description"),
    durationMins: fdString(fd, "durationMins"),
    bufferMins: fdString(fd, "bufferMins") || "0",
    color: fdString(fd, "color") || "#0F172A",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.publicSlug !== existing.publicSlug) {
    const slugTaken = await prisma.bookingType.findUnique({
      where: { publicSlug: parsed.data.publicSlug },
      select: { id: true },
    });
    if (slugTaken && slugTaken.id !== id) throw new Error("That slug is already in use");
  }

  await prisma.bookingType.update({
    where: { id },
    data: {
      name: parsed.data.name,
      publicSlug: parsed.data.publicSlug,
      description: parsed.data.description ?? null,
      durationMins: parsed.data.durationMins,
      bufferMins: parsed.data.bufferMins,
      color: parsed.data.color,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "bookingType",
    resourceId: id,
  });
  revalidatePath(`/app/bookings/types/${id}`);
  revalidatePath("/app/bookings/types");
}

export async function archiveBookingTypeAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bookingType", "edit");
  const existing = await prisma.bookingType.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking type not found");
  await prisma.bookingType.update({
    where: { id },
    data: { archived: !existing.archived },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "bookingType",
    resourceId: id,
    diff: { archived: !existing.archived },
  });
  revalidatePath("/app/bookings/types");
  revalidatePath(`/app/bookings/types/${id}`);
}

export async function updateAvailabilityAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bookingType", "edit");
  const existing = await prisma.bookingType.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking type not found");

  const rows: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] = [];
  for (let dow = 0; dow < 7; dow++) {
    const enabled = fd.get(`day_${dow}_enabled`);
    if (enabled === "on" || enabled === "true") {
      const start = String(fd.get(`day_${dow}_start`) ?? "");
      const end = String(fd.get(`day_${dow}_end`) ?? "");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
        throw new Error(`Day ${dow}: invalid time`);
      }
      const sm = toMinutes(start);
      const em = toMinutes(end);
      if (em <= sm) throw new Error(`Day ${dow}: end time must be after start`);
      rows.push({ dayOfWeek: dow, startMinutes: sm, endMinutes: em });
    }
  }

  await prisma.$transaction([
    prisma.bookingAvailability.deleteMany({ where: { bookingTypeId: id } }),
    ...(rows.length > 0
      ? [prisma.bookingAvailability.createMany({ data: rows.map((r) => ({ ...r, bookingTypeId: id })) })]
      : []),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "bookingType",
    resourceId: id,
    diff: { availability: rows.length },
  });
  revalidatePath(`/app/bookings/types/${id}`);
}

// ---------------- Authenticated: Booking transitions ----------------

export async function cancelBookingAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "booking", "edit");
  const existing = await prisma.booking.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking not found");
  if (existing.status !== "SCHEDULED") throw new Error("Only scheduled bookings can be cancelled");
  const parsed = cancelBookingSchema.safeParse({ reason: fdString(fd, "reason") });
  const reason = parsed.success ? parsed.data.reason : undefined;
  await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason ?? null },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "booking",
    resourceId: id,
    diff: { status: "CANCELLED", reason },
  });
  revalidatePath(`/app/bookings/${id}`);
  revalidatePath("/app/bookings");
}

export async function markCompletedAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "booking", "edit");
  const existing = await prisma.booking.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking not found");
  if (existing.status !== "SCHEDULED") throw new Error("Only scheduled bookings can be completed");
  await prisma.booking.update({ where: { id }, data: { status: "COMPLETED" } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "booking",
    resourceId: id,
    diff: { status: "COMPLETED" },
  });
  revalidatePath(`/app/bookings/${id}`);
  revalidatePath("/app/bookings");
}

export async function markNoShowAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "booking", "edit");
  const existing = await prisma.booking.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Booking not found");
  if (existing.status !== "SCHEDULED") throw new Error("Only scheduled bookings can be marked no-show");
  await prisma.booking.update({ where: { id }, data: { status: "NO_SHOW" } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "booking",
    resourceId: id,
    diff: { status: "NO_SHOW" },
  });
  revalidatePath(`/app/bookings/${id}`);
  revalidatePath("/app/bookings");
}

// ---------------- Public (no auth): create booking ----------------

export async function publicCreateBookingAction(slug: string, fd: FormData) {
  const parsed = publicBookingSchema.safeParse({
    attendeeName: fdString(fd, "attendeeName"),
    attendeeEmail: fdString(fd, "attendeeEmail"),
    attendeePhone: fdString(fd, "attendeePhone"),
    notes: fdString(fd, "notes"),
    startsAt: fdString(fd, "startsAt"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const bt = await prisma.bookingType.findUnique({
    where: { publicSlug: slug },
    include: { availability: true },
  });
  if (!bt || bt.archived) throw new Error("This booking page is no longer available");

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start time");
  if (startsAt.getTime() <= Date.now()) throw new Error("Pick a time in the future");

  const endsAt = new Date(startsAt.getTime() + bt.durationMins * 60_000);

  // Re-validate the slot is still allowed (concurrency guard).
  const dayStart = new Date(Date.UTC(
    startsAt.getUTCFullYear(),
    startsAt.getUTCMonth(),
    startsAt.getUTCDate(),
  ));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const concurrent = await prisma.booking.findMany({
    where: {
      bookingTypeId: bt.id,
      status: "SCHEDULED",
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: { startsAt: true, endsAt: true },
  });
  const slots = computeSlots(
    bt.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinutes: a.startMinutes,
      endMinutes: a.endMinutes,
    })),
    concurrent,
    {
      date: dayStart,
      durationMins: bt.durationMins,
      bufferMins: bt.bufferMins,
    },
  );
  const matched = slots.find((s) => s.getTime() === startsAt.getTime());
  if (!matched) throw new Error("That slot is no longer available");

  const booking = await prisma.booking.create({
    data: {
      workspaceId: bt.workspaceId,
      bookingTypeId: bt.id,
      hostId: bt.hostId,
      attendeeName: parsed.data.attendeeName,
      attendeeEmail: parsed.data.attendeeEmail,
      attendeePhone: parsed.data.attendeePhone ?? null,
      notes: parsed.data.notes ?? null,
      startsAt,
      endsAt,
      status: "SCHEDULED",
    },
  });

  revalidatePath("/app/bookings");
  redirect(`/book/${slug}/confirmed?id=${booking.publicId}`);
}
