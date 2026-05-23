"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { dealSchema, dealStatusSchema } from "@/modules/sales/schemas";
import { DealStatus } from "@prisma/client";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";
import { notifyUser } from "@/modules/notifications/notify";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    value: fd.get("value") ?? "0",
    currency: (fd.get("currency") as string) || "USD",
    pipelineId: fd.get("pipelineId") ?? "",
    stageId: fd.get("stageId") ?? "",
    contactId: fd.get("contactId") ?? "",
    companyId: fd.get("companyId") ?? "",
    ownerId: fd.get("ownerId") ?? "",
    expectedCloseAt: fd.get("expectedCloseAt") ?? "",
  };
}

async function assertStageInPipeline(workspaceId: string, pipelineId: string, stageId: string) {
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId, pipeline: { workspaceId } },
    select: { id: true },
  });
  if (!stage) throw new Error("Stage does not belong to pipeline");
}

export async function createDealAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "deal", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "deals");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const parsed = dealSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  await assertStageInPipeline(ctx.workspaceId, data.pipelineId, data.stageId);

  const deal = await prisma.deal.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      value: data.value,
      currency: data.currency,
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      contactId: data.contactId,
      companyId: data.companyId,
      ownerId: data.ownerId ?? ctx.userId,
      expectedCloseAt: data.expectedCloseAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "deal",
      resourceId: deal.id,
    },
  });
  revalidatePath("/app/sales/pipeline");
  revalidatePath("/app/sales/deals");
  redirect(`/app/sales/deals/${deal.id}`);
}

export async function updateDealAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "deal", "edit");
  const parsed = dealSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.deal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!existing) return { error: "Not found" };

  await assertStageInPipeline(ctx.workspaceId, data.pipelineId, data.stageId);

  await prisma.deal.update({
    where: { id },
    data: {
      name: data.name,
      value: data.value,
      currency: data.currency,
      pipelineId: data.pipelineId,
      stageId: data.stageId,
      contactId: data.contactId,
      companyId: data.companyId,
      ownerId: data.ownerId,
      expectedCloseAt: data.expectedCloseAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "deal",
      resourceId: id,
    },
  });
  // Notify the new owner if the deal was reassigned.
  if (data.ownerId && data.ownerId !== existing.ownerId && data.ownerId !== ctx.userId) {
    await notifyUser({
      workspaceId: ctx.workspaceId,
      userId: data.ownerId,
      type: "deal.updated",
      title: `Deal assigned to you: ${data.name}`,
      href: `/app/sales/deals/${id}`,
      meta: { dealId: id },
    });
  }
  revalidatePath(`/app/sales/deals/${id}`);
  revalidatePath("/app/sales/deals");
  revalidatePath("/app/sales/pipeline");
  return { ok: true };
}

export async function moveDealStageAction(input: { dealId: string; stageId: string }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "deal", "edit");

  const deal = await prisma.deal.findFirst({
    where: { id: input.dealId, workspaceId: ctx.workspaceId },
    select: { id: true, pipelineId: true, stageId: true, ownerId: true, name: true },
  });
  if (!deal) return { error: "Deal not found" };
  if (deal.stageId === input.stageId) return { ok: true };

  await assertStageInPipeline(ctx.workspaceId, deal.pipelineId, input.stageId);

  await prisma.deal.update({
    where: { id: deal.id },
    data: { stageId: input.stageId },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "stage_change",
      resource: "deal",
      resourceId: deal.id,
      diff: { from: deal.stageId, to: input.stageId },
    },
  });
  // Notify the deal owner when someone else moves the stage.
  if (deal.ownerId && deal.ownerId !== ctx.userId) {
    await notifyUser({
      workspaceId: ctx.workspaceId,
      userId: deal.ownerId,
      type: "deal.updated",
      title: `Deal stage changed: ${deal.name}`,
      href: `/app/sales/deals/${deal.id}`,
      meta: { dealId: deal.id, fromStage: deal.stageId, toStage: input.stageId },
    });
  }
  revalidatePath("/app/sales/pipeline");
  revalidatePath(`/app/sales/deals/${deal.id}`);
  return { ok: true };
}

export async function setDealStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "deal", "edit");
  const parsed = dealStatusSchema.safeParse({
    status: fd.get("status"),
    lostReason: fd.get("lostReason") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  const { status, lostReason } = parsed.data;

  const existing = await prisma.deal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };

  await prisma.deal.update({
    where: { id },
    data: {
      status,
      wonAt: status === DealStatus.WON ? new Date() : null,
      lostReason: status === DealStatus.LOST ? lostReason : null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: status === DealStatus.WON ? "won" : status === DealStatus.LOST ? "lost" : "reopen",
      resource: "deal",
      resourceId: id,
    },
  });
  revalidatePath(`/app/sales/deals/${id}`);
  revalidatePath("/app/sales/pipeline");
  return { ok: true };
}

export async function deleteDealAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "deal", "delete");
  const existing = await prisma.deal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.deal.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "deal",
      resourceId: id,
    },
  });
  revalidatePath("/app/sales/deals");
  revalidatePath("/app/sales/pipeline");
  redirect("/app/sales/deals");
}
