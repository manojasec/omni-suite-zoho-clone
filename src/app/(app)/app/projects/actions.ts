"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { projectSchema } from "@/modules/projects/schemas";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    description: fd.get("description") ?? "",
    status: (fd.get("status") as string) || "PLANNING",
    startDate: fd.get("startDate") ?? "",
    endDate: fd.get("endDate") ?? "",
    budgetHours: fd.get("budgetHours") ?? "",
    budgetAmount: fd.get("budgetAmount") ?? "",
  };
}

export async function createProjectAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "project", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "projects");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const parsed = projectSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const project = await prisma.project.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      description: data.description,
      status: data.status,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      budgetHours: data.budgetHours,
      budgetAmount: data.budgetAmount,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "project",
      resourceId: project.id,
    },
  });
  revalidatePath("/app/projects");
  redirect(`/app/projects/${project.id}`);
}

export async function updateProjectAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "project", "edit");
  const parsed = projectSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const existing = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.project.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      budgetHours: data.budgetHours,
      budgetAmount: data.budgetAmount,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "project",
      resourceId: id,
    },
  });
  revalidatePath(`/app/projects/${id}`);
  revalidatePath("/app/projects");
  return { ok: true };
}

export async function deleteProjectAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "project", "delete");
  const existing = await prisma.project.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.project.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "project",
      resourceId: id,
    },
  });
  revalidatePath("/app/projects");
  redirect("/app/projects");
}
