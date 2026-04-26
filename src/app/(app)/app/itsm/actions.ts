"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  CHANGE_STATUSES,
  PROBLEM_STATUSES,
  assetSchema,
  assignAssetSchema,
  canTransitionChange,
  canTransitionProblem,
  changeSchema,
  problemSchema,
  resolveProblemSchema,
} from "@/modules/itsm/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

async function nextAssetTag(workspaceId: string): Promise<string> {
  // Auto-suggest next sequential tag in form AST-0001 if none provided.
  const last = await prisma.asset.findFirst({
    where: { workspaceId, tag: { startsWith: "AST-" } },
    orderBy: { createdAt: "desc" },
    select: { tag: true },
  });
  let next = 1;
  if (last) {
    const m = last.tag.match(/AST-(\d+)/);
    if (m) next = Number(m[1]) + 1;
  }
  return `AST-${String(next).padStart(4, "0")}`;
}

async function nextNumber(
  workspaceId: string,
  resource: "change" | "problem",
): Promise<number> {
  if (resource === "change") {
    const last = await prisma.change.findFirst({
      where: { workspaceId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return (last?.number ?? 0) + 1;
  }
  const last = await prisma.problem.findFirst({
    where: { workspaceId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// ---------------- Assets ----------------

export async function createAssetAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "create");
  const raw = toFormObject(fd);
  const data = assetSchema.parse({
    ...raw,
    tag: raw.tag?.trim() || (await nextAssetTag(ctx.workspaceId)),
  });

  if (data.assignedToEmployeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: data.assignedToEmployeeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!emp) throw new Error("Assignee not found");
  }

  let asset;
  try {
    asset = await prisma.asset.create({
      data: {
        workspaceId: ctx.workspaceId,
        tag: data.tag,
        name: data.name,
        category: data.category,
        status: data.status,
        serial: data.serial,
        vendor: data.vendor,
        location: data.location,
        assignedToEmployeeId: data.assignedToEmployeeId ?? null,
        purchaseDate: data.purchaseDate ?? null,
        cost: data.cost != null ? new Prisma.Decimal(data.cost) : null,
        notes: data.notes,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Asset tag "${data.tag}" is already in use`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "asset",
    resourceId: asset.id,
    diff: { tag: asset.tag, name: asset.name },
  });

  revalidatePath("/app/itsm/assets");
  redirect(`/app/itsm/assets/${asset.id}`);
}

export async function updateAssetAction(assetId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "edit");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId: ctx.workspaceId },
  });
  if (!asset) throw new Error("Asset not found");

  const data = assetSchema.parse(toFormObject(fd));

  if (data.assignedToEmployeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: data.assignedToEmployeeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!emp) throw new Error("Assignee not found");
  }

  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        tag: data.tag,
        name: data.name,
        category: data.category,
        status: data.status,
        serial: data.serial,
        vendor: data.vendor,
        location: data.location,
        assignedToEmployeeId: data.assignedToEmployeeId ?? null,
        purchaseDate: data.purchaseDate ?? null,
        cost: data.cost != null ? new Prisma.Decimal(data.cost) : null,
        notes: data.notes,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Asset tag "${data.tag}" is already in use`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "asset",
    resourceId: assetId,
  });
  revalidatePath(`/app/itsm/assets/${assetId}`);
  revalidatePath("/app/itsm/assets");
}

export async function assignAssetAction(assetId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "assign");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!asset) throw new Error("Asset not found");

  const { assignedToEmployeeId } = assignAssetSchema.parse(toFormObject(fd));
  if (assignedToEmployeeId) {
    const emp = await prisma.employee.findFirst({
      where: { id: assignedToEmployeeId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!emp) throw new Error("Assignee not found");
  }
  await prisma.asset.update({
    where: { id: assetId },
    data: { assignedToEmployeeId: assignedToEmployeeId ?? null },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assign",
    resource: "asset",
    resourceId: assetId,
    diff: { assignedToEmployeeId: assignedToEmployeeId ?? null },
  });
  revalidatePath(`/app/itsm/assets/${assetId}`);
}

export async function deleteAssetAction(assetId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "delete");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!asset) throw new Error("Asset not found");
  await prisma.asset.delete({ where: { id: assetId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "asset",
    resourceId: assetId,
  });
  revalidatePath("/app/itsm/assets");
  redirect("/app/itsm/assets");
}

// ---------------- Changes ----------------

async function ensureAssetInWorkspace(workspaceId: string, assetId: string | undefined) {
  if (!assetId) return;
  const a = await prisma.asset.findFirst({
    where: { id: assetId, workspaceId },
    select: { id: true },
  });
  if (!a) throw new Error("Linked asset not found");
}

export async function createChangeAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "create");
  const data = changeSchema.parse(toFormObject(fd));
  await ensureAssetInWorkspace(ctx.workspaceId, data.assetId);

  const number = await nextNumber(ctx.workspaceId, "change");
  const change = await prisma.change.create({
    data: {
      workspaceId: ctx.workspaceId,
      number,
      title: data.title,
      description: data.description,
      risk: data.risk,
      assetId: data.assetId ?? null,
      requestedById: ctx.userId,
      scheduledAt: data.scheduledAt ?? null,
      rollbackPlan: data.rollbackPlan,
      notes: data.notes,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "change",
    resourceId: change.id,
    diff: { number, title: change.title },
  });
  revalidatePath("/app/itsm/changes");
  redirect(`/app/itsm/changes/${change.id}`);
}

export async function updateChangeAction(changeId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "edit");
  const ch = await prisma.change.findFirst({
    where: { id: changeId, workspaceId: ctx.workspaceId },
  });
  if (!ch) throw new Error("Change not found");
  if (ch.status === "COMPLETED" || ch.status === "REJECTED" || ch.status === "CANCELED") {
    throw new Error("Closed changes cannot be edited");
  }
  const data = changeSchema.parse(toFormObject(fd));
  await ensureAssetInWorkspace(ctx.workspaceId, data.assetId);

  await prisma.change.update({
    where: { id: changeId },
    data: {
      title: data.title,
      description: data.description,
      risk: data.risk,
      assetId: data.assetId ?? null,
      scheduledAt: data.scheduledAt ?? null,
      rollbackPlan: data.rollbackPlan,
      notes: data.notes,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "change",
    resourceId: changeId,
  });
  revalidatePath(`/app/itsm/changes/${changeId}`);
}

export async function transitionChangeAction(changeId: string, fd: FormData) {
  const ctx = await requireSession();
  const next = s(fd, "to");
  if (!CHANGE_STATUSES.includes(next as (typeof CHANGE_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const ch = await prisma.change.findFirst({
    where: { id: changeId, workspaceId: ctx.workspaceId },
  });
  if (!ch) throw new Error("Change not found");
  if (!canTransitionChange(ch.status, next as (typeof CHANGE_STATUSES)[number])) {
    throw new Error(`Cannot transition from ${ch.status} to ${next}`);
  }

  // Permission: APPROVED / REJECTED require manage; everything else needs edit.
  if (next === "APPROVED" || next === "REJECTED") {
    assertCan(ctx.role, "change", "manage");
  } else {
    assertCan(ctx.role, "change", "edit");
  }

  const update: Prisma.ChangeUpdateInput = {
    status: next as (typeof CHANGE_STATUSES)[number],
  };
  if (next === "APPROVED") update.approvedAt = new Date();
  if (next === "COMPLETED") update.completedAt = new Date();

  await prisma.change.update({ where: { id: changeId }, data: update });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "change",
    resourceId: changeId,
    diff: { from: ch.status, to: next },
  });
  revalidatePath(`/app/itsm/changes/${changeId}`);
  revalidatePath("/app/itsm/changes");
}

export async function deleteChangeAction(changeId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "delete");
  const ch = await prisma.change.findFirst({
    where: { id: changeId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!ch) throw new Error("Change not found");
  if (ch.status === "IN_PROGRESS") {
    throw new Error("In-progress changes cannot be deleted; cancel them first");
  }
  await prisma.change.delete({ where: { id: changeId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "change",
    resourceId: changeId,
  });
  revalidatePath("/app/itsm/changes");
  redirect("/app/itsm/changes");
}

// ---------------- Problems ----------------

export async function createProblemAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "create");
  const data = problemSchema.parse(toFormObject(fd));
  await ensureAssetInWorkspace(ctx.workspaceId, data.assetId);

  const number = await nextNumber(ctx.workspaceId, "problem");
  const problem = await prisma.problem.create({
    data: {
      workspaceId: ctx.workspaceId,
      number,
      title: data.title,
      description: data.description,
      priority: data.priority,
      assetId: data.assetId ?? null,
      workaround: data.workaround,
      rootCause: data.rootCause,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "problem",
    resourceId: problem.id,
    diff: { number, title: problem.title },
  });
  revalidatePath("/app/itsm/problems");
  redirect(`/app/itsm/problems/${problem.id}`);
}

export async function updateProblemAction(problemId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "edit");
  const p = await prisma.problem.findFirst({
    where: { id: problemId, workspaceId: ctx.workspaceId },
  });
  if (!p) throw new Error("Problem not found");
  if (p.status === "CLOSED") throw new Error("Closed problems cannot be edited");

  const data = problemSchema.parse(toFormObject(fd));
  await ensureAssetInWorkspace(ctx.workspaceId, data.assetId);

  await prisma.problem.update({
    where: { id: problemId },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      assetId: data.assetId ?? null,
      workaround: data.workaround,
      rootCause: data.rootCause,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "problem",
    resourceId: problemId,
  });
  revalidatePath(`/app/itsm/problems/${problemId}`);
}

export async function transitionProblemAction(problemId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "edit");
  const next = s(fd, "to");
  if (!PROBLEM_STATUSES.includes(next as (typeof PROBLEM_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const p = await prisma.problem.findFirst({
    where: { id: problemId, workspaceId: ctx.workspaceId },
  });
  if (!p) throw new Error("Problem not found");
  if (!canTransitionProblem(p.status, next as (typeof PROBLEM_STATUSES)[number])) {
    throw new Error(`Cannot transition from ${p.status} to ${next}`);
  }

  const update: Prisma.ProblemUpdateInput = {
    status: next as (typeof PROBLEM_STATUSES)[number],
  };
  if (next === "RESOLVED") update.resolvedAt = new Date();
  if (next === "OPEN") update.resolvedAt = null;

  await prisma.problem.update({ where: { id: problemId }, data: update });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "problem",
    resourceId: problemId,
    diff: { from: p.status, to: next },
  });
  revalidatePath(`/app/itsm/problems/${problemId}`);
  revalidatePath("/app/itsm/problems");
}

export async function resolveProblemAction(problemId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "edit");
  const { resolution } = resolveProblemSchema.parse(toFormObject(fd));
  const p = await prisma.problem.findFirst({
    where: { id: problemId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!p) throw new Error("Problem not found");
  if (p.status === "CLOSED") throw new Error("Problem already closed");

  await prisma.problem.update({
    where: { id: problemId },
    data: {
      status: "RESOLVED",
      resolution,
      resolvedAt: new Date(),
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "problem",
    resourceId: problemId,
    diff: { resolved: true },
  });
  revalidatePath(`/app/itsm/problems/${problemId}`);
}

export async function deleteProblemAction(problemId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "delete");
  const p = await prisma.problem.findFirst({
    where: { id: problemId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!p) throw new Error("Problem not found");
  await prisma.problem.delete({ where: { id: problemId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "problem",
    resourceId: problemId,
  });
  revalidatePath("/app/itsm/problems");
  redirect("/app/itsm/problems");
}

