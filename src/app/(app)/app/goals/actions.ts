"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  goalProgress,
  goalSchema,
  keyResultSchema,
  type KeyResultUnit,
} from "@/modules/goals/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

function parseKeyResults(fd: FormData) {
  const titles = fd.getAll("kr.title").map(String);
  const units = fd.getAll("kr.unit").map(String);
  const starts = fd.getAll("kr.start").map(String);
  const targets = fd.getAll("kr.target").map(String);
  const currents = fd.getAll("kr.current").map(String);
  const out: Array<{
    title: string;
    unit: KeyResultUnit;
    startValue: number;
    targetValue: number;
    currentValue: number;
  }> = [];
  for (let i = 0; i < titles.length; i += 1) {
    const title = titles[i]?.trim();
    if (!title) continue;
    const parsed = keyResultSchema.safeParse({
      title,
      unit: units[i] ?? "PERCENT",
      startValue: starts[i] ?? "0",
      targetValue: targets[i] ?? "100",
      currentValue: currents[i] ?? "0",
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid key result");
    }
    out.push(parsed.data);
  }
  return out;
}

export async function createGoalAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "create");

  const data = goalSchema.parse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    parentId: s(fd, "parentId"),
    ownerId: s(fd, "ownerId"),
    status: s(fd, "status") || "ON_TRACK",
    startDate: s(fd, "startDate"),
    dueDate: s(fd, "dueDate"),
  });

  const krs = parseKeyResults(fd);
  const progress = goalProgress(krs);

  const created = await prisma.goal.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: data.title,
      description: data.description || null,
      parentId: data.parentId || null,
      ownerId: data.ownerId || null,
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      progress,
      keyResults: {
        create: krs.map((kr, i) => ({
          title: kr.title,
          unit: kr.unit,
          startValue: kr.startValue,
          targetValue: kr.targetValue,
          currentValue: kr.currentValue,
          position: i,
        })),
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "goal.create",
    resource: "goal",
    resourceId: created.id,
    diff: { title: data.title },
  });

  revalidatePath("/app/goals");
  redirect(`/app/goals/${created.id}`);
}

export async function updateGoalAction(goalId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "edit");

  const existing = await prisma.goal.findFirst({
    where: { id: goalId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Goal not found");

  const data = goalSchema.parse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    parentId: s(fd, "parentId"),
    ownerId: s(fd, "ownerId"),
    status: s(fd, "status") || "ON_TRACK",
    startDate: s(fd, "startDate"),
    dueDate: s(fd, "dueDate"),
  });

  if (data.parentId && data.parentId === goalId) {
    throw new Error("Goal cannot be its own parent");
  }

  const krs = parseKeyResults(fd);
  const progress = goalProgress(krs);

  await prisma.$transaction([
    prisma.keyResult.deleteMany({ where: { goalId } }),
    prisma.goal.update({
      where: { id: goalId },
      data: {
        title: data.title,
        description: data.description || null,
        parentId: data.parentId || null,
        ownerId: data.ownerId || null,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        progress,
        keyResults: {
          create: krs.map((kr, i) => ({
            title: kr.title,
            unit: kr.unit,
            startValue: kr.startValue,
            targetValue: kr.targetValue,
            currentValue: kr.currentValue,
            position: i,
          })),
        },
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "goal.update",
    resource: "goal",
    resourceId: goalId,
    diff: { progress },
  });

  revalidatePath("/app/goals");
  revalidatePath(`/app/goals/${goalId}`);
}

export async function deleteGoalAction(goalId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "delete");

  const existing = await prisma.goal.findFirst({
    where: { id: goalId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Goal not found");

  await prisma.goal.delete({ where: { id: goalId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "goal.delete",
    resource: "goal",
    resourceId: goalId,
  });

  revalidatePath("/app/goals");
  redirect("/app/goals");
}
