"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import {
  canTransition,
  issueAssignSchema,
  issueCommentSchema,
  issueProjectSchema,
  issueSchema,
  issueStatusSchema,
  issueUpdateSchema,
  normaliseTags,
} from "@/modules/bugs/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

function dateOrNull(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------- Project CRUD ----------------

export async function createIssueProjectAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issueProject", "create");
  const parsed = issueProjectSchema.safeParse({
    name: s(fd, "name"),
    key: s(fd, "key"),
    description: s(fd, "description"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const proj = await prisma.issueProject.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      key: parsed.data.key,
      description: parsed.data.description ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "issueProject",
    resourceId: proj.id,
  });
  revalidatePath("/app/bugs");
  redirect(`/app/bugs/projects/${proj.id}`);
}

export async function updateIssueProjectAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issueProject", "edit");
  const proj = await prisma.issueProject.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!proj) throw new Error("Project not found");
  const parsed = issueProjectSchema.safeParse({
    name: s(fd, "name"),
    key: s(fd, "key"),
    description: s(fd, "description"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.issueProject.update({
    where: { id },
    data: {
      name: parsed.data.name,
      key: parsed.data.key,
      description: parsed.data.description ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "issueProject",
    resourceId: id,
  });
  revalidatePath(`/app/bugs/projects/${id}`);
  revalidatePath("/app/bugs");
}

export async function archiveIssueProjectAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issueProject", "edit");
  const proj = await prisma.issueProject.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!proj) throw new Error("Project not found");
  await prisma.issueProject.update({
    where: { id },
    data: { archived: !proj.archived },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "issueProject",
    resourceId: id,
    diff: { archived: !proj.archived },
  });
  revalidatePath(`/app/bugs/projects/${id}`);
  revalidatePath("/app/bugs");
}

// ---------------- Issue CRUD ----------------

export async function createIssueAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issue", "create");
  const parsed = issueSchema.safeParse({
    projectId: s(fd, "projectId"),
    title: s(fd, "title"),
    description: s(fd, "description"),
    type: s(fd, "type") || "BUG",
    priority: s(fd, "priority") || "MEDIUM",
    severity: s(fd, "severity") || "MINOR",
    assigneeId: s(fd, "assigneeId"),
    environment: s(fd, "environment"),
    stepsToReproduce: s(fd, "stepsToReproduce"),
    expected: s(fd, "expected"),
    actual: s(fd, "actual"),
    version: s(fd, "version"),
    dueDate: s(fd, "dueDate"),
    tags: s(fd, "tags"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const proj = await prisma.issueProject.findFirst({
    where: { id: parsed.data.projectId, workspaceId: ctx.workspaceId },
  });
  if (!proj) throw new Error("Project not found");
  if (proj.archived) throw new Error("Cannot create issues in an archived project");

  // Validate assignee belongs to workspace.
  let assigneeId: string | null = null;
  if (parsed.data.assigneeId) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: parsed.data.assigneeId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (!m) throw new Error("Assignee is not a member of this workspace");
    assigneeId = m.userId;
  }

  const issue = await prisma.$transaction(async (tx) => {
    const last = await tx.issue.findFirst({
      where: { projectId: proj.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;
    return tx.issue.create({
      data: {
        workspaceId: ctx.workspaceId,
        projectId: proj.id,
        number,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
        priority: parsed.data.priority,
        severity: parsed.data.severity,
        status: "OPEN",
        reporterId: ctx.userId,
        assigneeId,
        environment: parsed.data.environment ?? null,
        stepsToReproduce: parsed.data.stepsToReproduce ?? null,
        expected: parsed.data.expected ?? null,
        actual: parsed.data.actual ?? null,
        version: parsed.data.version ?? null,
        dueDate: dateOrNull(parsed.data.dueDate),
        tags: normaliseTags(parsed.data.tags) ?? null,
      },
    });
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "issue",
    resourceId: issue.id,
  });
  revalidatePath(`/app/bugs/projects/${proj.id}`);
  redirect(`/app/bugs/issues/${issue.id}`);
}

export async function updateIssueAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issue", "edit");
  const existing = await prisma.issue.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Issue not found");
  const parsed = issueUpdateSchema.safeParse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    type: s(fd, "type"),
    priority: s(fd, "priority"),
    severity: s(fd, "severity"),
    status: s(fd, "status"),
    assigneeId: s(fd, "assigneeId"),
    environment: s(fd, "environment"),
    stepsToReproduce: s(fd, "stepsToReproduce"),
    expected: s(fd, "expected"),
    actual: s(fd, "actual"),
    version: s(fd, "version"),
    dueDate: s(fd, "dueDate"),
    tags: s(fd, "tags"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.status !== existing.status && !canTransition(existing.status, parsed.data.status)) {
    throw new Error(`Cannot move from ${existing.status} to ${parsed.data.status}`);
  }

  let assigneeId: string | null = existing.assigneeId;
  if (parsed.data.assigneeId !== undefined) {
    if (!parsed.data.assigneeId) {
      assigneeId = null;
    } else {
      const m = await prisma.membership.findFirst({
        where: { workspaceId: ctx.workspaceId, userId: parsed.data.assigneeId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (!m) throw new Error("Assignee is not a member of this workspace");
      assigneeId = m.userId;
    }
  }

  const now = new Date();
  await prisma.issue.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      priority: parsed.data.priority,
      severity: parsed.data.severity,
      status: parsed.data.status,
      assigneeId,
      environment: parsed.data.environment ?? null,
      stepsToReproduce: parsed.data.stepsToReproduce ?? null,
      expected: parsed.data.expected ?? null,
      actual: parsed.data.actual ?? null,
      version: parsed.data.version ?? null,
      dueDate: dateOrNull(parsed.data.dueDate),
      tags: normaliseTags(parsed.data.tags) ?? null,
      resolvedAt:
        parsed.data.status === "RESOLVED" && existing.status !== "RESOLVED"
          ? now
          : parsed.data.status === "OPEN" || parsed.data.status === "REOPENED" || parsed.data.status === "IN_PROGRESS"
            ? null
            : existing.resolvedAt,
      closedAt:
        parsed.data.status === "CLOSED" && existing.status !== "CLOSED"
          ? now
          : parsed.data.status === "REOPENED"
            ? null
            : existing.closedAt,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "issue",
    resourceId: id,
    diff: { status: parsed.data.status },
  });
  revalidatePath(`/app/bugs/issues/${id}`);
  revalidatePath(`/app/bugs/projects/${existing.projectId}`);
}

export async function changeIssueStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issue", "edit");
  const issue = await prisma.issue.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!issue) throw new Error("Issue not found");
  const parsed = issueStatusSchema.safeParse({ status: s(fd, "status") });
  if (!parsed.success) throw new Error("Invalid status");
  if (!canTransition(issue.status, parsed.data.status)) {
    throw new Error(`Cannot move from ${issue.status} to ${parsed.data.status}`);
  }
  const now = new Date();
  await prisma.issue.update({
    where: { id },
    data: {
      status: parsed.data.status,
      resolvedAt:
        parsed.data.status === "RESOLVED" ? now : parsed.data.status === "REOPENED" ? null : issue.resolvedAt,
      closedAt:
        parsed.data.status === "CLOSED" ? now : parsed.data.status === "REOPENED" ? null : issue.closedAt,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "issue",
    resourceId: id,
    diff: { status: parsed.data.status, from: issue.status },
  });
  revalidatePath(`/app/bugs/issues/${id}`);
  revalidatePath(`/app/bugs/projects/${issue.projectId}`);
}

export async function assignIssueAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issue", "assign");
  const issue = await prisma.issue.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!issue) throw new Error("Issue not found");
  const parsed = issueAssignSchema.safeParse({ assigneeId: s(fd, "assigneeId") });
  if (!parsed.success) throw new Error("Invalid assignee");
  let assigneeId: string | null = null;
  if (parsed.data.assigneeId) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId: ctx.workspaceId, userId: parsed.data.assigneeId, status: "ACTIVE" },
      select: { userId: true },
    });
    if (!m) throw new Error("Assignee is not a member of this workspace");
    assigneeId = m.userId;
  }
  await prisma.issue.update({ where: { id }, data: { assigneeId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "assign",
    resource: "issue",
    resourceId: id,
    diff: { assigneeId },
  });
  revalidatePath(`/app/bugs/issues/${id}`);
  revalidatePath(`/app/bugs/projects/${issue.projectId}`);
}

export async function deleteIssueAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issue", "delete");
  const issue = await prisma.issue.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!issue) throw new Error("Issue not found");
  await prisma.issue.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "issue",
    resourceId: id,
  });
  revalidatePath(`/app/bugs/projects/${issue.projectId}`);
  redirect(`/app/bugs/projects/${issue.projectId}`);
}

// ---------------- Comments ----------------

export async function addIssueCommentAction(issueId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "issueComment", "create");
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!issue) throw new Error("Issue not found");
  const parsed = issueCommentSchema.safeParse({ body: s(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid comment");
  await prisma.issueComment.create({
    data: {
      workspaceId: ctx.workspaceId,
      issueId,
      authorId: ctx.userId,
      body: parsed.data.body,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "issueComment",
    resourceId: issueId,
  });
  revalidatePath(`/app/bugs/issues/${issueId}`);
}
