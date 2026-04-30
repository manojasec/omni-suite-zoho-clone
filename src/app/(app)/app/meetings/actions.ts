"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  attendeeSchema,
  chatSchema,
  generateJoinCode,
  meetingSchema,
} from "@/modules/meetings/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generateJoinCode();
    const exists = await prisma.meeting.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Unable to allocate join code");
}

export async function createMeetingAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "create");

  const parsed = meetingSchema.parse({
    kind: s(fd, "kind") || "MEETING",
    title: s(fd, "title"),
    description: s(fd, "description"),
    scheduledAt: s(fd, "scheduledAt"),
    durationMin: s(fd, "durationMin") || "30",
    attendeeLimit: s(fd, "attendeeLimit") || "100",
  });

  const joinCode = await uniqueJoinCode();
  const created = await prisma.meeting.create({
    data: {
      workspaceId: ctx.workspaceId,
      hostId: ctx.userId,
      kind: parsed.kind,
      title: parsed.title,
      description: parsed.description || null,
      scheduledAt: parsed.scheduledAt,
      durationMin: parsed.durationMin,
      attendeeLimit: parsed.attendeeLimit,
      joinCode,
      attendees: {
        create: {
          userId: ctx.userId,
          name: ctx.name || ctx.email,
          email: ctx.email,
          role: "HOST",
        },
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "meeting.create",
    resource: "meeting",
    resourceId: created.id,
    diff: { title: parsed.title, kind: parsed.kind, joinCode },
  });

  revalidatePath("/app/meetings");
  redirect(`/app/meetings/${created.id}`);
}

async function loadMeeting(workspaceId: string, id: string) {
  const m = await prisma.meeting.findFirst({
    where: { id, workspaceId },
    select: { id: true, status: true, scheduledAt: true, startedAt: true },
  });
  if (!m) throw new Error("Meeting not found");
  return m;
}

export async function startMeetingAction(meetingId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "edit");
  const m = await loadMeeting(ctx.workspaceId, meetingId);
  if (m.status !== "SCHEDULED") return;

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "LIVE", startedAt: new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "meeting.start",
    resource: "meeting",
    resourceId: meetingId,
  });

  revalidatePath(`/app/meetings/${meetingId}`);
}

export async function endMeetingAction(meetingId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "edit");
  const m = await loadMeeting(ctx.workspaceId, meetingId);
  if (m.status === "ENDED" || m.status === "CANCELLED") return;

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "ENDED", endedAt: new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "meeting.end",
    resource: "meeting",
    resourceId: meetingId,
  });

  revalidatePath(`/app/meetings/${meetingId}`);
}

export async function cancelMeetingAction(meetingId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "edit");
  const m = await loadMeeting(ctx.workspaceId, meetingId);
  if (m.status !== "SCHEDULED") return;

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "CANCELLED" },
  });

  revalidatePath(`/app/meetings/${meetingId}`);
}

export async function addAttendeeAction(meetingId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "edit");
  await loadMeeting(ctx.workspaceId, meetingId);

  const parsed = attendeeSchema.parse({
    name: s(fd, "name"),
    email: s(fd, "email"),
    role: s(fd, "role") || "ATTENDEE",
  });

  await prisma.meetingAttendee.create({
    data: {
      meetingId,
      name: parsed.name,
      email: parsed.email || null,
      role: parsed.role,
    },
  });

  revalidatePath(`/app/meetings/${meetingId}`);
}

export async function postMeetingChatAction(
  meetingId: string,
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "edit");
  await loadMeeting(ctx.workspaceId, meetingId);

  const parsed = chatSchema.parse({ body: s(fd, "body") });

  await prisma.meetingMessage.create({
    data: {
      meetingId,
      actorId: ctx.userId,
      authorName: ctx.name || ctx.email,
      body: parsed.body,
    },
  });

  revalidatePath(`/app/meetings/${meetingId}`);
}

export async function deleteMeetingAction(meetingId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "delete");

  const existing = await prisma.meeting.findFirst({
    where: { id: meetingId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Meeting not found");

  await prisma.meeting.delete({ where: { id: meetingId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "meeting.delete",
    resource: "meeting",
    resourceId: meetingId,
  });

  revalidatePath("/app/meetings");
  redirect("/app/meetings");
}
