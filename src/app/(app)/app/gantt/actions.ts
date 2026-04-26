"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  ganttDependencySchema,
  ganttTaskSchema,
  wouldCreateCycle,
} from "@/modules/gantt/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadTaskInWorkspace(taskId: string, workspaceId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, workspaceId },
    select: { id: true, projectId: true },
  });
}

export async function updateGanttTaskAction(taskId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "gantt", "edit");

  const task = await loadTaskInWorkspace(taskId, ctx.workspaceId);
  if (!task) throw new Error("Task not found");

  const parsed = ganttTaskSchema.parse(toFormObject(fd));
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      startAt: parsed.startAt ? new Date(parsed.startAt) : null,
      endAt: parsed.endAt ? new Date(parsed.endAt) : null,
      progress: parsed.progress,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "gantt.task.update",
    resource: "task",
    resourceId: updated.id,
    diff: parsed,
  });
  revalidatePath("/app/gantt");
}

export async function createGanttDependencyAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "gantt", "edit");

  const parsed = ganttDependencySchema.parse(toFormObject(fd));

  const [pre, suc] = await Promise.all([
    loadTaskInWorkspace(parsed.predecessorId, ctx.workspaceId),
    loadTaskInWorkspace(parsed.successorId, ctx.workspaceId),
  ]);
  if (!pre || !suc) throw new Error("Task not found");

  const edges = await prisma.taskDependency.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { predecessorId: true, successorId: true },
  });
  if (wouldCreateCycle(edges, parsed.predecessorId, parsed.successorId)) {
    throw new Error("That dependency would create a cycle");
  }

  const created = await prisma.taskDependency.create({
    data: {
      workspaceId: ctx.workspaceId,
      predecessorId: parsed.predecessorId,
      successorId: parsed.successorId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "gantt.dependency.create",
    resource: "taskDependency",
    resourceId: created.id,
    diff: parsed,
  });
  revalidatePath("/app/gantt");
}

export async function deleteGanttDependencyAction(
  dependencyId: string,
  _fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "gantt", "edit");

  const dep = await prisma.taskDependency.findFirst({
    where: { id: dependencyId, workspaceId: ctx.workspaceId },
  });
  if (!dep) throw new Error("Dependency not found");

  await prisma.taskDependency.delete({ where: { id: dependencyId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "gantt.dependency.delete",
    resource: "taskDependency",
    resourceId: dep.id,
  });
  revalidatePath("/app/gantt");
}
