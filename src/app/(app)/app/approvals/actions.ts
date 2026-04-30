"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  approvalPolicySchema,
  approvalRequestSchema,
  decodeApprovers,
  encodeApprovers,
  isApprover,
} from "@/modules/approvals/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createApprovalPolicyAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "manage");

  const approverIds = fd.getAll("approverIds").map(String).filter(Boolean);

  const data = approvalPolicySchema.parse({
    name: s(fd, "name"),
    resource: s(fd, "resource"),
    threshold: s(fd, "threshold"),
    approverIds,
    isActive: fd.get("isActive") === "on",
  });

  const created = await prisma.approvalPolicy.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      resource: data.resource,
      threshold: data.threshold ?? null,
      approverIds: encodeApprovers(data.approverIds),
      isActive: data.isActive,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approval.policy.create",
    resource: "approval",
    resourceId: created.id,
    diff: { name: data.name, resource: data.resource },
  });

  revalidatePath("/app/approvals");
}

export async function deleteApprovalPolicyAction(policyId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "manage");

  const existing = await prisma.approvalPolicy.findFirst({
    where: { id: policyId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Policy not found");

  await prisma.approvalPolicy.delete({ where: { id: policyId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approval.policy.delete",
    resource: "approval",
    resourceId: policyId,
  });

  revalidatePath("/app/approvals");
}

export async function createApprovalRequestAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "create");

  const data = approvalRequestSchema.parse({
    resource: s(fd, "resource"),
    resourceId: s(fd, "resourceId"),
    amount: s(fd, "amount"),
    reason: s(fd, "reason"),
  });

  // Pick the active policy with the lowest non-null threshold that the amount triggers,
  // or the catch-all (threshold null) if no amount is given.
  const policies = await prisma.approvalPolicy.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      resource: data.resource,
      isActive: true,
    },
  });
  const matching = policies
    .filter((p) => {
      if (p.threshold == null) return true;
      if (data.amount == null) return false;
      return data.amount >= Number(p.threshold);
    })
    .sort((a, b) => Number(b.threshold ?? 0) - Number(a.threshold ?? 0));
  const policy = matching[0] ?? null;

  const created = await prisma.approvalRequest.create({
    data: {
      workspaceId: ctx.workspaceId,
      policyId: policy?.id ?? null,
      resource: data.resource,
      resourceId: data.resourceId,
      requesterId: ctx.userId,
      amount: data.amount ?? null,
      reason: data.reason || null,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approval.request.create",
    resource: "approval",
    resourceId: created.id,
    diff: {
      resource: data.resource,
      resourceId: data.resourceId,
      policyId: policy?.id ?? null,
    },
  });

  revalidatePath("/app/approvals");
  redirect(`/app/approvals/${created.id}`);
}

async function decide(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "edit");

  const note = String(fd.get("note") ?? "").trim() || null;

  const req = await prisma.approvalRequest.findFirst({
    where: { id: requestId, workspaceId: ctx.workspaceId },
    include: { policy: true },
  });
  if (!req) throw new Error("Request not found");
  if (req.status !== "PENDING") throw new Error("Already decided");

  const approverIds = req.policy
    ? decodeApprovers(req.policy.approverIds)
    : [];
  if (approverIds.length > 0 && !isApprover(approverIds, ctx.userId)) {
    throw new Error("You are not an approver for this request");
  }

  await prisma.$transaction([
    prisma.approvalDecisionLog.create({
      data: {
        requestId,
        approverId: ctx.userId,
        decision,
        note,
      },
    }),
    prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        decisionNote: note,
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: `approval.${decision.toLowerCase()}`,
    resource: "approval",
    resourceId: requestId,
  });

  revalidatePath("/app/approvals");
  revalidatePath(`/app/approvals/${requestId}`);
}

export async function approveApprovalRequestAction(
  requestId: string,
  fd: FormData,
) {
  await decide(requestId, "APPROVED", fd);
}

export async function rejectApprovalRequestAction(
  requestId: string,
  fd: FormData,
) {
  await decide(requestId, "REJECTED", fd);
}

export async function cancelApprovalRequestAction(requestId: string) {
  const ctx = await requireSession();

  const req = await prisma.approvalRequest.findFirst({
    where: { id: requestId, workspaceId: ctx.workspaceId },
    select: { id: true, requesterId: true, status: true },
  });
  if (!req) throw new Error("Request not found");
  if (req.requesterId !== ctx.userId) {
    assertCan(ctx.role, "approval", "manage");
  }
  if (req.status !== "PENDING") throw new Error("Already decided");

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      decidedById: ctx.userId,
      decidedAt: new Date(),
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approval.cancel",
    resource: "approval",
    resourceId: requestId,
  });

  revalidatePath("/app/approvals");
  revalidatePath(`/app/approvals/${requestId}`);
}
