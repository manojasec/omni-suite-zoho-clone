"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { taskSchema, taskStatusMoveSchema } from "@/modules/projects/schemas";
import type { TaskStatus } from "@prisma/client";
import { notifyUser } from "@/modules/notifications/notify";

function fdToObj(fd: FormData) {
  return {
    title: fd.get("title") ?? "",
    description: fd.get("description") ?? "",
    status: (fd.get("status") as string) || "TODO",
    priority: (fd.get("priority") as string) || "MEDIUM",
    projectId: fd.get("projectId") ?? "",
    parentTaskId: fd.get("parentTaskId") ?? "",
    assigneeId: fd.get("assigneeId") ?? "",
    dueAt: fd.get("dueAt") ?? "",
  };
}

async function assertProjectInWorkspace(workspaceId: string, projectId: string | null) {
  if (!projectId) return;
  const p = await prisma.project.findFirst({ where: { id: projectId, workspaceId }, select: { id: true } });
  if (!p) throw new Error("Project does not belong to this workspace");
}

export async function createTaskAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "task", "create");
  const parsed = taskSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  await assertProjectInWorkspace(ctx.workspaceId, data.projectId);

  const task = await prisma.task.create({
    data: {
      workspaceId: ctx.workspaceId,
      projectId: data.projectId,
      parentTaskId: data.parentTaskId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId,
      dueAt: data.dueAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "task",
      resourceId: task.id,
    },
  });
  if (task.assigneeId && task.assigneeId !== ctx.userId) {
    await notifyUser({
      workspaceId: ctx.workspaceId,
      userId: task.assigneeId,
      type: "task.assigned",
      title: `New task: ${task.title}`,
      href: task.projectId ? `/app/projects/${task.projectId}` : "/app/tasks",
    });
  }
  if (data.projectId) revalidatePath(`/app/projects/${data.projectId}`);
  revalidatePath("/app/tasks");
  return { ok: true, id: task.id };
}

export async function updateTaskAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "task", "edit");
  const parsed = taskSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const existing = await prisma.task.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, projectId: true, assigneeId: true, title: true },
  });
  if (!existing) return { error: "Not found" };
  await assertProjectInWorkspace(ctx.workspaceId, data.projectId);

  await prisma.task.update({
    where: { id },
    data: {
      projectId: data.projectId,
      parentTaskId: data.parentTaskId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId,
      dueAt: data.dueAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "task",
      resourceId: id,
    },
  });
  if (data.assigneeId && data.assigneeId !== existing.assigneeId && data.assigneeId !== ctx.userId) {
    await notifyUser({
      workspaceId: ctx.workspaceId,
      userId: data.assigneeId,
      type: "task.assigned",
      title: `Assigned to you: ${data.title}`,
      href: data.projectId ? `/app/projects/${data.projectId}` : "/app/tasks",
    });
  }
  if (existing.projectId) revalidatePath(`/app/projects/${existing.projectId}`);
  if (data.projectId && data.projectId !== existing.projectId) revalidatePath(`/app/projects/${data.projectId}`);
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function moveTaskStatusAction(input: { taskId: string; status: TaskStatus }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "task", "edit");
  const parsed = taskStatusMoveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const existing = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, projectId: true },
  });
  if (!existing) return { error: "Not found" };
  if (existing.status === parsed.data.status) return { ok: true };
  await prisma.task.update({ where: { id: existing.id }, data: { status: parsed.data.status } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "task",
      resourceId: existing.id,
      diff: { from: existing.status, to: parsed.data.status },
    },
  });
  if (existing.projectId) revalidatePath(`/app/projects/${existing.projectId}`);
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function deleteTaskAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "task", "delete");
  const existing = await prisma.task.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, projectId: true },
  });
  if (!existing) return;
  await prisma.task.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "task",
      resourceId: id,
    },
  });
  if (existing.projectId) {
    revalidatePath(`/app/projects/${existing.projectId}`);
    redirect(`/app/projects/${existing.projectId}`);
  }
  revalidatePath("/app/tasks");
  redirect("/app/tasks");
}
