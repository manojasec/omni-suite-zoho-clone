"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  computeNextRunAt,
  enrollContactSchema,
  updateWorkflowStatusSchema,
  workflowSchema,
  workflowStepSchema,
} from "@/modules/automation/schemas";
import { processDueEnrollments } from "@/modules/automation/engine";

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Workflow CRUD ----------------

export async function createWorkflowAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "create");

  const parsed = workflowSchema.safeParse({
    name: fdString(fd, "name"),
    description: fdString(fd, "description"),
    trigger: fdString(fd, "trigger") || "MANUAL",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const wf = await prisma.workflow.create({
    data: { workspaceId: ctx.workspaceId, ...parsed.data },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "workflow",
    resourceId: wf.id,
    diff: { name: wf.name },
  });

  redirect(`/app/automation/${wf.id}`);
}

export async function updateWorkflowAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "edit");

  const parsed = workflowSchema.safeParse({
    name: fdString(fd, "name"),
    description: fdString(fd, "description"),
    trigger: fdString(fd, "trigger") || "MANUAL",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const wf = await prisma.workflow.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  await prisma.workflow.update({ where: { id }, data: parsed.data });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "workflow",
    resourceId: id,
    diff: { name: { from: wf.name, to: parsed.data.name } },
  });
  revalidatePath(`/app/automation/${id}`);
}

export async function updateWorkflowStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "manage");

  const parsed = updateWorkflowStatusSchema.safeParse({ status: fdString(fd, "status") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid status");

  const wf = await prisma.workflow.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  if (parsed.data.status === "ACTIVE") {
    const stepCount = await prisma.workflowStep.count({ where: { workflowId: id } });
    if (stepCount === 0) throw new Error("Add at least one step before activating");
  }

  await prisma.workflow.update({ where: { id }, data: { status: parsed.data.status } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "workflow",
    resourceId: id,
    diff: { status: { from: wf.status, to: parsed.data.status } },
  });
  revalidatePath(`/app/automation/${id}`);
  revalidatePath("/app/automation");
}

export async function deleteWorkflowAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "delete");

  const wf = await prisma.workflow.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  await prisma.workflow.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "workflow",
    resourceId: id,
    diff: { name: wf.name },
  });
  redirect("/app/automation");
}

// ---------------- Steps ----------------

export async function addWorkflowStepAction(workflowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "edit");

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  const parsed = workflowStepSchema.safeParse({
    type: fdString(fd, "type"),
    waitDays: fdString(fd, "waitDays") || undefined,
    emailSubject: fdString(fd, "emailSubject"),
    emailHtml: fdString(fd, "emailHtml"),
    tag: fdString(fd, "tag"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid step");

  const last = await prisma.workflowStep.findFirst({
    where: { workflowId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  await prisma.workflowStep.create({
    data: {
      workflowId,
      order: nextOrder,
      type: parsed.data.type,
      waitDays: parsed.data.waitDays ?? null,
      emailSubject: parsed.data.emailSubject ?? null,
      emailHtml: parsed.data.emailHtml ?? null,
      tag: parsed.data.tag ?? null,
    },
  });
  revalidatePath(`/app/automation/${workflowId}`);
}

export async function deleteWorkflowStepAction(workflowId: string, stepId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "edit");

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  const step = await prisma.workflowStep.findFirst({ where: { id: stepId, workflowId } });
  if (!step) throw new Error("Step not found");

  await prisma.$transaction(async (tx) => {
    await tx.workflowStep.delete({ where: { id: stepId } });
    // Re-pack order indexes.
    const remaining = await tx.workflowStep.findMany({
      where: { workflowId },
      orderBy: { order: "asc" },
    });
    // Two-phase reorder to avoid unique-constraint collisions on (workflowId, order).
    for (let i = 0; i < remaining.length; i++) {
      await tx.workflowStep.update({
        where: { id: remaining[i].id },
        data: { order: 1000 + i },
      });
    }
    for (let i = 0; i < remaining.length; i++) {
      await tx.workflowStep.update({
        where: { id: remaining[i].id },
        data: { order: i },
      });
    }
  });
  revalidatePath(`/app/automation/${workflowId}`);
}

// ---------------- Enrollments ----------------

export async function enrollContactAction(workflowId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflowEnrollment", "create");

  const parsed = enrollContactSchema.safeParse({ contactId: fdString(fd, "contactId") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pick a contact");

  const wf = await prisma.workflow.findFirst({
    where: { id: workflowId, workspaceId: ctx.workspaceId },
    include: { steps: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!wf) throw new Error("Workflow not found");
  if (wf.steps.length === 0) throw new Error("Workflow has no steps");

  const contact = await prisma.contact.findFirst({
    where: { id: parsed.data.contactId, workspaceId: ctx.workspaceId },
  });
  if (!contact) throw new Error("Contact not found");

  const existing = await prisma.workflowEnrollment.findUnique({
    where: { workflowId_contactId: { workflowId, contactId: contact.id } },
  });
  if (existing) throw new Error("Contact is already enrolled in this workflow");

  const firstStep = wf.steps[0];
  await prisma.workflowEnrollment.create({
    data: {
      workspaceId: ctx.workspaceId,
      workflowId,
      contactId: contact.id,
      nextRunAt: computeNextRunAt(firstStep.type, firstStep.waitDays),
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "workflowEnrollment",
    resourceId: workflowId,
    diff: { contactId: contact.id },
  });
  revalidatePath(`/app/automation/${workflowId}`);
}

export async function exitEnrollmentAction(workflowId: string, enrollmentId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflowEnrollment", "edit");

  const en = await prisma.workflowEnrollment.findFirst({
    where: { id: enrollmentId, workspaceId: ctx.workspaceId, workflowId },
  });
  if (!en) throw new Error("Enrollment not found");

  await prisma.workflowEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "EXITED", completedAt: new Date() },
  });
  revalidatePath(`/app/automation/${workflowId}`);
}

export async function runDueEnrollmentsAction(workflowId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "workflow", "manage");

  const wf = await prisma.workflow.findFirst({ where: { id: workflowId, workspaceId: ctx.workspaceId } });
  if (!wf) throw new Error("Workflow not found");

  const result = await processDueEnrollments(ctx.workspaceId);
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "manage",
    resource: "workflow",
    resourceId: workflowId,
    diff: result as unknown as Record<string, unknown>,
  });
  revalidatePath(`/app/automation/${workflowId}`);
  revalidatePath("/app/automation");
}
