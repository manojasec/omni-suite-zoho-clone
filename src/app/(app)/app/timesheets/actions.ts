"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  computeDurationSec,
  manualEntrySchema,
  startTimerSchema,
  updateEntrySchema,
} from "@/modules/time-tracking/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function ensureTaskBelongsToWorkspace(
  taskId: string | undefined,
  workspaceId: string,
) {
  if (!taskId) return null;
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, projectId: true },
  });
  if (!task) throw new Error("Task not found");
  return task;
}

async function ensureProjectBelongsToWorkspace(
  projectId: string | undefined,
  workspaceId: string,
) {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

export async function startTimerAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "create");

  const parsed = startTimerSchema.parse(toFormObject(fd));

  const running = await prisma.timeEntry.findFirst({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId, endedAt: null },
    select: { id: true },
  });
  if (running) {
    throw new Error("You already have a running timer. Stop it first.");
  }

  const task = await ensureTaskBelongsToWorkspace(parsed.taskId, ctx.workspaceId);
  const projectIdFromTask = task?.projectId ?? undefined;
  const project = await ensureProjectBelongsToWorkspace(
    parsed.projectId ?? projectIdFromTask,
    ctx.workspaceId,
  );

  const entry = await prisma.timeEntry.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      taskId: task?.id,
      projectId: project?.id ?? projectIdFromTask,
      description: parsed.description || null,
      startedAt: new Date(),
      billable: parsed.billable,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "timeEntry.start",
    resource: "timeEntry",
    resourceId: entry.id,
    diff: parsed,
  });
  revalidatePath("/app/timesheets");
}

export async function stopTimerAction(entryId: string, _fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "edit");

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, workspaceId: ctx.workspaceId, userId: ctx.userId },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.endedAt) throw new Error("Timer already stopped");

  const endedAt = new Date();
  const durationSec = computeDurationSec(entry.startedAt, endedAt);
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { endedAt, durationSec },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "timeEntry.stop",
    resource: "timeEntry",
    resourceId: entry.id,
    diff: { durationSec },
  });
  revalidatePath("/app/timesheets");
}

export async function createManualEntryAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "create");

  const parsed = manualEntrySchema.parse(toFormObject(fd));
  const task = await ensureTaskBelongsToWorkspace(parsed.taskId, ctx.workspaceId);
  const projectIdFromTask = task?.projectId ?? undefined;
  const project = await ensureProjectBelongsToWorkspace(
    parsed.projectId ?? projectIdFromTask,
    ctx.workspaceId,
  );

  const durationSec = computeDurationSec(parsed.startedAt, parsed.endedAt);
  const entry = await prisma.timeEntry.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      taskId: task?.id,
      projectId: project?.id ?? projectIdFromTask,
      description: parsed.description || null,
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      durationSec,
      billable: parsed.billable,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "timeEntry.create",
    resource: "timeEntry",
    resourceId: entry.id,
    diff: { ...parsed, durationSec },
  });
  revalidatePath("/app/timesheets");
}

export async function updateTimeEntryAction(entryId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "edit");

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, workspaceId: ctx.workspaceId },
    select: { id: true, userId: true },
  });
  if (!entry) throw new Error("Entry not found");

  const parsed = updateEntrySchema.parse(toFormObject(fd));
  const task = await ensureTaskBelongsToWorkspace(parsed.taskId, ctx.workspaceId);
  const projectIdFromTask = task?.projectId ?? undefined;
  const project = await ensureProjectBelongsToWorkspace(
    parsed.projectId ?? projectIdFromTask,
    ctx.workspaceId,
  );
  const durationSec = computeDurationSec(parsed.startedAt, parsed.endedAt);
  const updated = await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      taskId: task?.id ?? null,
      projectId: project?.id ?? projectIdFromTask ?? null,
      description: parsed.description || null,
      startedAt: parsed.startedAt,
      endedAt: parsed.endedAt,
      durationSec,
      billable: parsed.billable,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "timeEntry.update",
    resource: "timeEntry",
    resourceId: updated.id,
    diff: { ...parsed, durationSec },
  });
  revalidatePath("/app/timesheets");
}

export async function deleteTimeEntryAction(entryId: string, _fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "delete");

  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, workspaceId: ctx.workspaceId },
  });
  if (!entry) throw new Error("Entry not found");

  await prisma.timeEntry.delete({ where: { id: entryId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "timeEntry.delete",
    resource: "timeEntry",
    resourceId: entry.id,
  });
  revalidatePath("/app/timesheets");
}
