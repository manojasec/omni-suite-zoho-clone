"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  FLOW_NODE_KINDS,
  FLOW_STATUSES,
  canTransitionFlow,
  defaultStarterGraph,
  flowApprovalDecisionSchema,
  flowEdgeSchema,
  flowNodeSchema,
  flowSchema,
  validateFlowGraph,
} from "@/modules/flows/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Flow definition ----------------

export async function createFlowAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "create");
  const data = flowSchema.parse(toFormObject(fd));

  let flow;
  try {
    flow = await prisma.flow.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        status: "DRAFT",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A flow named "${data.name}" already exists`);
    }
    throw e;
  }

  const starter = defaultStarterGraph();
  await prisma.flowNode.createMany({
    data: starter.nodes.map((n) => ({
      flowId: flow.id,
      key: n.key,
      kind: n.kind,
      label: n.label,
      posX: n.posX,
      posY: n.posY,
    })),
  });
  for (const e of starter.edges) {
    await prisma.flowEdge.create({
      data: {
        flowId: flow.id,
        fromKey: e.fromKey,
        toKey: e.toKey,
        branch: e.branch ?? null,
      },
    });
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "flow",
    resourceId: flow.id,
    diff: { name: flow.name },
  });
  revalidatePath("/app/flows");
  redirect(`/app/flows/${flow.id}`);
}

export async function updateFlowAction(flowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!flow) throw new Error("Flow not found");
  const data = flowSchema.parse(toFormObject(fd));
  try {
    await prisma.flow.update({
      where: { id: flowId },
      data: {
        name: data.name,
        description: data.description,
        trigger: data.trigger,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A flow named "${data.name}" already exists`);
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "flow",
    resourceId: flowId,
  });
  revalidatePath(`/app/flows/${flowId}`);
}

export async function transitionFlowAction(flowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const target = s(fd, "to");
  if (!FLOW_STATUSES.includes(target as (typeof FLOW_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    include: {
      nodes: { select: { key: true, kind: true } },
      edges: { select: { fromKey: true, toKey: true, branch: true } },
    },
  });
  if (!flow) throw new Error("Flow not found");
  if (
    !canTransitionFlow(
      flow.status,
      target as (typeof FLOW_STATUSES)[number],
    )
  ) {
    throw new Error(`Cannot transition from ${flow.status} to ${target}`);
  }
  if (target === "ACTIVE") {
    const issues = validateFlowGraph(flow.nodes, flow.edges);
    if (issues.length > 0) {
      throw new Error(
        `Cannot activate: ${issues[0].message}${
          issues.length > 1 ? ` (+${issues.length - 1} more)` : ""
        }`,
      );
    }
  }
  await prisma.flow.update({
    where: { id: flowId },
    data: { status: target as (typeof FLOW_STATUSES)[number] },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "flow",
    resourceId: flowId,
    diff: { from: flow.status, to: target },
  });
  revalidatePath(`/app/flows/${flowId}`);
  revalidatePath("/app/flows");
}

export async function deleteFlowAction(flowId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "delete");
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!flow) throw new Error("Flow not found");
  if (flow.status === "ACTIVE") {
    throw new Error("Pause the flow before deleting it");
  }
  await prisma.flow.delete({ where: { id: flowId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "flow",
    resourceId: flowId,
  });
  revalidatePath("/app/flows");
  redirect("/app/flows");
}

// ---------------- Nodes ----------------

export async function createFlowNodeAction(flowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!flow) throw new Error("Flow not found");
  if (flow.status !== "DRAFT" && flow.status !== "PAUSED") {
    throw new Error("Pause the flow before editing its graph");
  }
  const data = flowNodeSchema.parse(toFormObject(fd));
  try {
    await prisma.flowNode.create({
      data: {
        flowId: flow.id,
        key: data.key,
        kind: data.kind,
        label: data.label,
        posX: data.posX,
        posY: data.posY,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Node key "${data.key}" already exists in this flow`);
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "flow",
    resourceId: flow.id,
    diff: { node: data.key },
  });
  revalidatePath(`/app/flows/${flow.id}`);
}

export async function deleteFlowNodeAction(nodeId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const node = await prisma.flowNode.findFirst({
    where: { id: nodeId, flow: { workspaceId: ctx.workspaceId } },
    select: { id: true, key: true, flowId: true, flow: { select: { status: true } } },
  });
  if (!node) throw new Error("Node not found");
  if (node.flow.status === "ACTIVE") {
    throw new Error("Pause the flow before editing its graph");
  }
  // Remove edges referencing this key, then delete node.
  await prisma.flowEdge.deleteMany({
    where: {
      flowId: node.flowId,
      OR: [{ fromKey: node.key }, { toKey: node.key }],
    },
  });
  await prisma.flowNode.delete({ where: { id: nodeId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "flow",
    resourceId: node.flowId,
    diff: { node: node.key },
  });
  revalidatePath(`/app/flows/${node.flowId}`);
}

// ---------------- Edges ----------------

export async function createFlowEdgeAction(flowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!flow) throw new Error("Flow not found");
  if (flow.status === "ACTIVE") {
    throw new Error("Pause the flow before editing its graph");
  }
  const data = flowEdgeSchema.parse(toFormObject(fd));
  if (data.fromKey === data.toKey) {
    throw new Error("Edges cannot loop on the same node");
  }
  // Validate keys exist.
  const count = await prisma.flowNode.count({
    where: { flowId: flow.id, key: { in: [data.fromKey, data.toKey] } },
  });
  if (count !== 2) throw new Error("Both source and target nodes must exist");

  await prisma.flowEdge.create({
    data: {
      flowId: flow.id,
      fromKey: data.fromKey,
      toKey: data.toKey,
      branch: data.branch ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "flow",
    resourceId: flow.id,
    diff: { from: data.fromKey, to: data.toKey, branch: data.branch ?? null },
  });
  revalidatePath(`/app/flows/${flow.id}`);
}

export async function deleteFlowEdgeAction(edgeId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "edit");
  const edge = await prisma.flowEdge.findFirst({
    where: { id: edgeId, flow: { workspaceId: ctx.workspaceId } },
    select: { id: true, flowId: true, flow: { select: { status: true } } },
  });
  if (!edge) throw new Error("Edge not found");
  if (edge.flow.status === "ACTIVE") {
    throw new Error("Pause the flow before editing its graph");
  }
  await prisma.flowEdge.delete({ where: { id: edgeId } });
  revalidatePath(`/app/flows/${edge.flowId}`);
}

// ---------------- Runs ----------------

export async function startFlowRunAction(flowId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "create");
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId: ctx.workspaceId },
    include: {
      nodes: { select: { key: true, kind: true } },
      edges: { select: { fromKey: true, toKey: true, branch: true } },
    },
  });
  if (!flow) throw new Error("Flow not found");
  if (flow.status !== "ACTIVE") {
    throw new Error("Only ACTIVE flows can be triggered");
  }
  const issues = validateFlowGraph(flow.nodes, flow.edges);
  if (issues.length > 0) {
    throw new Error(`Flow has validation issues: ${issues[0].message}`);
  }
  const start = flow.nodes.find((n) => n.kind === "START");
  if (!start) throw new Error("Flow is missing a START node");

  const run = await prisma.flowRun.create({
    data: {
      flowId: flow.id,
      workspaceId: ctx.workspaceId,
      status: "RUNNING",
      currentNodeKey: start.key,
      triggeredById: ctx.userId,
    },
  });
  await prisma.flowRunStep.create({
    data: {
      runId: run.id,
      nodeKey: start.key,
      kind: "START",
      status: "COMPLETED",
      finishedAt: new Date(),
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "flowRun",
    resourceId: run.id,
    diff: { flowId: flow.id },
  });
  revalidatePath("/app/flows/runs");
  redirect(`/app/flows/runs/${run.id}`);
}

export async function advanceRunAction(runId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "manage");
  const nextKey = s(fd, "nodeKey");
  const note = s(fd, "note") || null;
  const run = await prisma.flowRun.findFirst({
    where: { id: runId, workspaceId: ctx.workspaceId },
    include: {
      flow: {
        include: {
          nodes: { select: { key: true, kind: true } },
        },
      },
    },
  });
  if (!run) throw new Error("Run not found");
  if (run.status !== "RUNNING") {
    throw new Error(`Cannot advance a run in ${run.status} status`);
  }
  const targetNode = run.flow.nodes.find((n) => n.key === nextKey);
  if (!targetNode) throw new Error("Target node not found");

  const isApproval = targetNode.kind === "APPROVAL";
  const isEnd = targetNode.kind === "END";

  await prisma.flowRunStep.create({
    data: {
      runId: run.id,
      nodeKey: targetNode.key,
      kind: targetNode.kind,
      status: isApproval ? "RUNNING" : isEnd ? "COMPLETED" : "COMPLETED",
      finishedAt: isApproval ? null : new Date(),
      note,
      ...(isApproval ? { approvalDecision: "PENDING" as const } : {}),
    },
  });
  await prisma.flowRun.update({
    where: { id: runId },
    data: {
      currentNodeKey: targetNode.key,
      status: isApproval
        ? "AWAITING_APPROVAL"
        : isEnd
          ? "COMPLETED"
          : "RUNNING",
      finishedAt: isEnd ? new Date() : null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "flowRun",
    resourceId: runId,
    diff: { advancedTo: targetNode.key },
  });
  revalidatePath(`/app/flows/runs/${runId}`);
}

export async function decideApprovalAction(stepId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowApproval", "manage");
  const data = flowApprovalDecisionSchema.parse({
    decision: s(fd, "decision"),
    comment: s(fd, "comment") || undefined,
  });
  const step = await prisma.flowRunStep.findFirst({
    where: {
      id: stepId,
      run: { workspaceId: ctx.workspaceId },
    },
    include: { run: { select: { id: true, status: true } } },
  });
  if (!step) throw new Error("Approval step not found");
  if (step.kind !== "APPROVAL") throw new Error("Step is not an approval");
  if (step.approvalDecision !== "PENDING") {
    throw new Error("Approval has already been decided");
  }
  if (step.run.status !== "AWAITING_APPROVAL") {
    throw new Error("Run is not awaiting approval");
  }

  const now = new Date();
  await prisma.flowRunStep.update({
    where: { id: stepId },
    data: {
      approvalDecision: data.decision,
      approverId: ctx.userId,
      decidedAt: now,
      comment: data.comment ?? null,
      status: data.decision === "APPROVED" ? "COMPLETED" : "FAILED",
      finishedAt: now,
    },
  });
  await prisma.flowRun.update({
    where: { id: step.run.id },
    data: {
      status: data.decision === "APPROVED" ? "RUNNING" : "FAILED",
      finishedAt: data.decision === "REJECTED" ? now : null,
      error:
        data.decision === "REJECTED" ? "Approval rejected" : null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "flowApproval",
    resourceId: stepId,
    diff: { decision: data.decision },
  });
  revalidatePath(`/app/flows/runs/${step.run.id}`);
  revalidatePath("/app/flows/approvals");
}

export async function cancelRunAction(runId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "manage");
  const run = await prisma.flowRun.findFirst({
    where: { id: runId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!run) throw new Error("Run not found");
  if (run.status === "COMPLETED" || run.status === "CANCELED" || run.status === "FAILED") {
    throw new Error("Run is already finished");
  }
  await prisma.flowRun.update({
    where: { id: runId },
    data: { status: "CANCELED", finishedAt: new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "flowRun",
    resourceId: runId,
    diff: { from: run.status, to: "CANCELED" },
  });
  revalidatePath(`/app/flows/runs/${runId}`);
  revalidatePath("/app/flows/runs");
}

export async function deleteRunAction(runId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "flowRun", "delete");
  const run = await prisma.flowRun.findFirst({
    where: { id: runId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!run) throw new Error("Run not found");
  if (run.status === "RUNNING" || run.status === "AWAITING_APPROVAL") {
    throw new Error("Cancel the run before deleting it");
  }
  await prisma.flowRun.delete({ where: { id: runId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "flowRun",
    resourceId: runId,
  });
  revalidatePath("/app/flows/runs");
  redirect("/app/flows/runs");
}

// Re-export NODE_KINDS for UI clients without re-importing schemas module.
export async function getNodeKindOptions(): Promise<readonly string[]> {
  return FLOW_NODE_KINDS;
}
