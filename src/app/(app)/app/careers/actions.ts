"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { careerJobSlugSchema, slugifyTitle } from "@/modules/recruit/career-schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

/** Set or clear the career-site slug for a job opening. Empty string clears it. */
export async function setJobSlugAction(jobId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "careerSite", "edit");

  const raw = s(fd, "slug").trim();
  const parsed = careerJobSlugSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid slug");
  }

  const job = await prisma.jobOpening.findFirst({
    where: { id: jobId, workspaceId: ctx.workspaceId },
    select: { id: true, slug: true, title: true },
  });
  if (!job) throw new Error("Job not found");

  const next = raw === "" ? null : raw;
  if (next === job.slug) {
    revalidatePath("/app/careers");
    return;
  }

  if (next !== null) {
    const collision = await prisma.jobOpening.findFirst({
      where: { workspaceId: ctx.workspaceId, slug: next, NOT: { id: jobId } },
      select: { id: true },
    });
    if (collision) throw new Error("That slug is already in use by another job");
  }

  await prisma.jobOpening.update({
    where: { id: jobId },
    data: { slug: next },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "careerSite.slug.set",
    resource: "jobOpening",
    resourceId: jobId,
    diff: { from: job.slug, to: next },
  });

  revalidatePath("/app/careers");
}

/** Auto-fill the slug from the job's title if currently empty. */
export async function suggestJobSlugAction(jobId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "careerSite", "edit");

  const job = await prisma.jobOpening.findFirst({
    where: { id: jobId, workspaceId: ctx.workspaceId },
    select: { id: true, title: true, slug: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.slug) return;

  const base = slugifyTitle(job.title);
  if (!base) return;

  let candidate = base;
  let suffix = 2;
  // Ensure uniqueness within workspace.
  while (true) {
    const existing = await prisma.jobOpening.findFirst({
      where: { workspaceId: ctx.workspaceId, slug: candidate },
      select: { id: true },
    });
    if (!existing) break;
    candidate = `${base}-${suffix}`.slice(0, 160);
    suffix += 1;
    if (suffix > 50) throw new Error("Could not generate a unique slug");
  }

  await prisma.jobOpening.update({
    where: { id: jobId },
    data: { slug: candidate },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "careerSite.slug.set",
    resource: "jobOpening",
    resourceId: jobId,
    diff: { from: null, to: candidate },
  });

  revalidatePath("/app/careers");
}
