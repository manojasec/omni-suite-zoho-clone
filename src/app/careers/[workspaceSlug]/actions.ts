"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import { applicationSubmissionSchema } from "@/modules/recruit/career-schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

/** Public job application — no session required. Identifies workspace+job by slug. */
export async function submitApplicationAction(
  workspaceSlug: string,
  jobSlug: string,
  fd: FormData,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  });
  if (!workspace) throw new Error("Career site not found");

  const job = await prisma.jobOpening.findFirst({
    where: { workspaceId: workspace.id, slug: jobSlug, status: "OPEN" },
    select: { id: true },
  });
  if (!job) throw new Error("This position is no longer accepting applications");

  const parsed = applicationSubmissionSchema.safeParse({
    firstName: s(fd, "firstName"),
    lastName: s(fd, "lastName"),
    email: s(fd, "email"),
    phone: s(fd, "phone"),
    headline: s(fd, "headline"),
    location: s(fd, "location"),
    linkedinUrl: s(fd, "linkedinUrl"),
    resumeUrl: s(fd, "resumeUrl"),
    coverLetter: s(fd, "coverLetter"),
    source: "career-site",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid submission");
  }
  const data = parsed.data;

  const candidate = await prisma.candidate.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: data.email } },
    create: {
      workspaceId: workspace.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      headline: data.headline || null,
      location: data.location || null,
      linkedinUrl: data.linkedinUrl || null,
      resumeUrl: data.resumeUrl || null,
      source: "career-site",
    },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || undefined,
      headline: data.headline || undefined,
      location: data.location || undefined,
      linkedinUrl: data.linkedinUrl || undefined,
      resumeUrl: data.resumeUrl || undefined,
    },
    select: { id: true },
  });

  const existing = await prisma.application.findUnique({
    where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
    select: { id: true },
  });
  if (existing) {
    throw new Error("You've already applied to this position");
  }

  const application = await prisma.application.create({
    data: {
      workspaceId: workspace.id,
      jobId: job.id,
      candidateId: candidate.id,
      stage: "APPLIED",
      notes: data.coverLetter ? data.coverLetter : null,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: workspace.id,
    actorId: null,
    action: "careerSite.application.submit",
    resource: "application",
    resourceId: application.id,
    diff: { jobId: job.id, candidateId: candidate.id },
  });

  redirect(`/careers/${workspaceSlug}/${jobSlug}/thanks`);
}
