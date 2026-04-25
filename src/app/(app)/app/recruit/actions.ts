"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  applicationCreateSchema,
  applicationUpdateSchema,
  candidateSchema,
  interviewSchema,
  isValidStageTransition,
  jobOpeningSchema,
} from "@/modules/recruit/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ===== Job Openings =====

export async function createJobAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "create");
  const parsed = jobOpeningSchema.safeParse({
    title: s(fd, "title"),
    department: s(fd, "department") || undefined,
    location: s(fd, "location") || undefined,
    remote: s(fd, "remote") === "on" || s(fd, "remote") === "true",
    employment: s(fd, "employment"),
    status: s(fd, "status") || "DRAFT",
    description: s(fd, "description") || undefined,
    salaryMin: s(fd, "salaryMin"),
    salaryMax: s(fd, "salaryMax"),
    currency: s(fd, "currency") || "USD",
    openings: s(fd, "openings") || "1",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const job = await prisma.jobOpening.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      title: parsed.data.title,
      department: parsed.data.department || null,
      location: parsed.data.location || null,
      remote: parsed.data.remote,
      employment: parsed.data.employment,
      status: parsed.data.status,
      description: parsed.data.description || null,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      openings: parsed.data.openings,
      publishedAt: parsed.data.status === "OPEN" ? new Date() : null,
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "jobOpening", resourceId: job.id });
  redirect(`/app/recruit/jobs/${job.id}`);
}

export async function updateJobAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "edit");
  const existing = await prisma.jobOpening.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const parsed = jobOpeningSchema.safeParse({
    title: s(fd, "title"),
    department: s(fd, "department") || undefined,
    location: s(fd, "location") || undefined,
    remote: s(fd, "remote") === "on" || s(fd, "remote") === "true",
    employment: s(fd, "employment"),
    status: s(fd, "status"),
    description: s(fd, "description") || undefined,
    salaryMin: s(fd, "salaryMin"),
    salaryMax: s(fd, "salaryMax"),
    currency: s(fd, "currency") || "USD",
    openings: s(fd, "openings") || "1",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const willPublish = existing.status !== "OPEN" && parsed.data.status === "OPEN";
  const willClose = existing.status !== "CLOSED" && parsed.data.status === "CLOSED";
  await prisma.jobOpening.update({
    where: { id },
    data: {
      title: parsed.data.title,
      department: parsed.data.department || null,
      location: parsed.data.location || null,
      remote: parsed.data.remote,
      employment: parsed.data.employment,
      status: parsed.data.status,
      description: parsed.data.description || null,
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      currency: parsed.data.currency,
      openings: parsed.data.openings,
      publishedAt: willPublish ? new Date() : existing.publishedAt,
      closedAt: willClose ? new Date() : (parsed.data.status === "CLOSED" ? existing.closedAt : null),
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "jobOpening", resourceId: id });
  redirect(`/app/recruit/jobs/${id}`);
}

export async function deleteJobAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "delete");
  const existing = await prisma.jobOpening.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  await prisma.jobOpening.delete({ where: { id } });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "jobOpening", resourceId: id });
  redirect("/app/recruit/jobs");
}

// ===== Candidates =====

export async function createCandidateAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "create");
  const parsed = candidateSchema.safeParse({
    firstName: s(fd, "firstName"),
    lastName: s(fd, "lastName"),
    email: s(fd, "email"),
    phone: s(fd, "phone") || undefined,
    headline: s(fd, "headline") || undefined,
    location: s(fd, "location") || undefined,
    linkedinUrl: s(fd, "linkedinUrl") || undefined,
    resumeUrl: s(fd, "resumeUrl") || undefined,
    source: s(fd, "source") || undefined,
    notes: s(fd, "notes") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const dup = await prisma.candidate.findFirst({ where: { workspaceId: ctx.workspaceId, email: parsed.data.email } });
  if (dup) throw new Error("Candidate with this email already exists");
  const c = await prisma.candidate.create({
    data: {
      workspaceId: ctx.workspaceId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      headline: parsed.data.headline || null,
      location: parsed.data.location || null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      resumeUrl: parsed.data.resumeUrl || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "candidate", resourceId: c.id });
  redirect(`/app/recruit/candidates/${c.id}`);
}

export async function updateCandidateAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "edit");
  const existing = await prisma.candidate.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const parsed = candidateSchema.safeParse({
    firstName: s(fd, "firstName"),
    lastName: s(fd, "lastName"),
    email: s(fd, "email"),
    phone: s(fd, "phone") || undefined,
    headline: s(fd, "headline") || undefined,
    location: s(fd, "location") || undefined,
    linkedinUrl: s(fd, "linkedinUrl") || undefined,
    resumeUrl: s(fd, "resumeUrl") || undefined,
    source: s(fd, "source") || undefined,
    notes: s(fd, "notes") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.candidate.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      headline: parsed.data.headline || null,
      location: parsed.data.location || null,
      linkedinUrl: parsed.data.linkedinUrl || null,
      resumeUrl: parsed.data.resumeUrl || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "candidate", resourceId: id });
  redirect(`/app/recruit/candidates/${id}`);
}

export async function archiveCandidateAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "edit");
  const existing = await prisma.candidate.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  await prisma.candidate.update({
    where: { id },
    data: { status: existing.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED" },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "candidate", resourceId: id });
  redirect(`/app/recruit/candidates/${id}`);
}

// ===== Applications =====

export async function createApplicationAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "application", "create");
  const parsed = applicationCreateSchema.safeParse({
    jobId: s(fd, "jobId"),
    candidateId: s(fd, "candidateId"),
    stage: s(fd, "stage") || "APPLIED",
    rating: s(fd, "rating") || undefined,
    notes: s(fd, "notes") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const [job, cand] = await Promise.all([
    prisma.jobOpening.findFirst({ where: { id: parsed.data.jobId, workspaceId: ctx.workspaceId } }),
    prisma.candidate.findFirst({ where: { id: parsed.data.candidateId, workspaceId: ctx.workspaceId } }),
  ]);
  if (!job || !cand) throw new Error("Job or candidate not found");
  const dup = await prisma.application.findFirst({ where: { jobId: job.id, candidateId: cand.id } });
  if (dup) throw new Error("Candidate already applied to this job");
  const app = await prisma.application.create({
    data: {
      workspaceId: ctx.workspaceId,
      jobId: job.id,
      candidateId: cand.id,
      stage: parsed.data.stage,
      rating: parsed.data.rating ?? null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "application", resourceId: app.id });
  redirect(`/app/recruit/applications/${app.id}`);
}

export async function updateApplicationAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "application", "edit");
  const existing = await prisma.application.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const parsed = applicationUpdateSchema.safeParse({
    stage: s(fd, "stage"),
    rating: s(fd, "rating") || undefined,
    notes: s(fd, "notes") || undefined,
    rejectedReason: s(fd, "rejectedReason") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  if (!isValidStageTransition(existing.stage, parsed.data.stage)) {
    throw new Error(`Cannot move from ${existing.stage} to ${parsed.data.stage}`);
  }
  const decided = ["HIRED", "REJECTED", "WITHDRAWN"].includes(parsed.data.stage);
  await prisma.application.update({
    where: { id },
    data: {
      stage: parsed.data.stage,
      rating: parsed.data.rating ?? null,
      notes: parsed.data.notes || null,
      rejectedReason: parsed.data.rejectedReason || null,
      decidedAt: decided ? (existing.decidedAt ?? new Date()) : null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "application",
    resourceId: id,
    diff: { stage: { from: existing.stage, to: parsed.data.stage } },
  });
  redirect(`/app/recruit/applications/${id}`);
}

export async function moveApplicationStageAction(id: string, stage: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "application", "edit");
  const existing = await prisma.application.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const parsed = applicationUpdateSchema.pick({ stage: true }).safeParse({ stage });
  if (!parsed.success) throw new Error("Invalid stage");
  if (!isValidStageTransition(existing.stage, parsed.data.stage)) {
    throw new Error(`Cannot move from ${existing.stage} to ${parsed.data.stage}`);
  }
  const decided = ["HIRED", "REJECTED", "WITHDRAWN"].includes(parsed.data.stage);
  await prisma.application.update({
    where: { id },
    data: { stage: parsed.data.stage, decidedAt: decided ? (existing.decidedAt ?? new Date()) : null },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "application",
    resourceId: id,
    diff: { stage: { from: existing.stage, to: parsed.data.stage } },
  });
  redirect(`/app/recruit/pipeline`);
}

// ===== Interviews =====

export async function createInterviewAction(applicationId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "interview", "create");
  const app = await prisma.application.findFirst({ where: { id: applicationId, workspaceId: ctx.workspaceId } });
  if (!app) throw new Error("Application not found");
  const parsed = interviewSchema.safeParse({
    kind: s(fd, "kind") || "VIDEO",
    scheduledAt: s(fd, "scheduledAt"),
    durationMins: s(fd, "durationMins") || "45",
    location: s(fd, "location") || undefined,
    interviewer: s(fd, "interviewer") || undefined,
    outcome: s(fd, "outcome") || "PENDING",
    feedback: s(fd, "feedback") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const iv = await prisma.interview.create({
    data: {
      workspaceId: ctx.workspaceId,
      applicationId: app.id,
      kind: parsed.data.kind,
      scheduledAt: parsed.data.scheduledAt,
      durationMins: parsed.data.durationMins,
      location: parsed.data.location || null,
      interviewer: parsed.data.interviewer || null,
      outcome: parsed.data.outcome,
      feedback: parsed.data.feedback || null,
    },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "create", resource: "interview", resourceId: iv.id });
  redirect(`/app/recruit/applications/${app.id}`);
}

export async function updateInterviewOutcomeAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "interview", "edit");
  const existing = await prisma.interview.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const outcome = s(fd, "outcome");
  const feedback = s(fd, "feedback");
  if (!["PENDING", "PASS", "FAIL", "NO_SHOW"].includes(outcome)) throw new Error("Invalid outcome");
  await prisma.interview.update({
    where: { id },
    data: { outcome: outcome as never, feedback: feedback || null },
  });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "edit", resource: "interview", resourceId: id });
  redirect(`/app/recruit/applications/${existing.applicationId}`);
}

export async function deleteInterviewAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "interview", "delete");
  const existing = await prisma.interview.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  await prisma.interview.delete({ where: { id } });
  await recordAuditEvent({ workspaceId: ctx.workspaceId, actorId: ctx.userId, action: "delete", resource: "interview", resourceId: id });
  redirect(`/app/recruit/applications/${existing.applicationId}`);
}
