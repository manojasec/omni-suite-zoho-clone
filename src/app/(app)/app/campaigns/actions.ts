"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { CampaignStatus } from "@prisma/client";
import { campaignSchema, audienceSchema, sendCampaignSchema } from "@/modules/marketing/schemas";
import { compileAudienceWhere } from "@/modules/marketing/audience";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";

// ---------- AUDIENCES ----------

function audienceFromFd(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    filterDsl: {
      stage: fd.getAll("stage").map(String) as ("LEAD")[],
      tag: (fd.get("tags") as string | null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
      hasEmail: fd.get("hasEmail") === "on",
    },
  };
}

export async function createAudienceAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "audience", "create");
  const parsed = audienceSchema.safeParse(audienceFromFd(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const created = await prisma.audience.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      filterDsl: parsed.data.filterDsl,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "audience",
      resourceId: created.id,
    },
  });
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/audiences/${created.id}`);
}

export async function updateAudienceAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "audience", "edit");
  const parsed = audienceSchema.safeParse(audienceFromFd(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const existing = await prisma.audience.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.audience.update({
    where: { id },
    data: { name: parsed.data.name, filterDsl: parsed.data.filterDsl },
  });
  revalidatePath(`/app/campaigns/audiences/${id}`);
  return { ok: true };
}

export async function deleteAudienceAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "audience", "delete");
  const existing = await prisma.audience.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.audience.delete({ where: { id } });
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}

// ---------- CAMPAIGNS ----------

function campaignFromFd(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    audienceId: (fd.get("audienceId") as string | null) ?? "",
    subject: fd.get("subject") ?? "",
    html: fd.get("html") ?? "",
    status: (fd.get("status") as string) || "DRAFT",
    scheduledAt: fd.get("scheduledAt") ?? "",
  };
}

export async function createCampaignAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "campaigns");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const parsed = campaignSchema.safeParse(campaignFromFd(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const created = await prisma.campaign.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      audienceId: data.audienceId,
      subject: data.subject,
      html: data.html,
      status: CampaignStatus.DRAFT,
      scheduledAt: data.scheduledAt ?? null,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "campaign",
      resourceId: created.id,
    },
  });
  revalidatePath("/app/campaigns");
  redirect(`/app/campaigns/${created.id}`);
}

export async function updateCampaignAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "edit");
  const parsed = campaignSchema.safeParse(campaignFromFd(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "Not found" };
  if (existing.status === CampaignStatus.SENT || existing.status === CampaignStatus.SENDING) {
    return { error: "Cannot edit a campaign that is sending or has been sent" };
  }
  await prisma.campaign.update({
    where: { id },
    data: {
      name: data.name,
      audienceId: data.audienceId,
      subject: data.subject,
      html: data.html,
      scheduledAt: data.scheduledAt ?? null,
    },
  });
  revalidatePath(`/app/campaigns/${id}`);
  revalidatePath("/app/campaigns");
  return { ok: true };
}

export async function deleteCampaignAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "delete");
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) return;
  if (existing.status === CampaignStatus.SENT || existing.status === CampaignStatus.SENDING) {
    redirect(`/app/campaigns/${id}`);
  }
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/app/campaigns");
  redirect("/app/campaigns");
}

/**
 * Mock send. In production this would push every recipient through an
 * email provider job queue (Postmark, SES, Resend, …). For MVP we
 * simply walk the audience to count recipients and flip the status.
 */
export async function sendCampaignAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "send");
  const parsed = sendCampaignSchema.safeParse({ scheduledAt: fd.get("scheduledAt") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { audience: true },
  });
  if (!campaign) return { error: "Not found" };
  if (campaign.status === CampaignStatus.SENT || campaign.status === CampaignStatus.SENDING) {
    return { error: "Already sending" };
  }

  let recipientCount = 0;
  if (campaign.audience) {
    const where = compileAudienceWhere(
      ctx.workspaceId,
      (campaign.audience.filterDsl as object) ?? {},
    );
    recipientCount = await prisma.contact.count({ where });
  }

  const isScheduled = parsed.data.scheduledAt && parsed.data.scheduledAt > new Date();
  await prisma.campaign.update({
    where: { id },
    data: {
      status: isScheduled ? CampaignStatus.SCHEDULED : CampaignStatus.SENT,
      scheduledAt: parsed.data.scheduledAt ?? null,
      sentAt: isScheduled ? null : new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: isScheduled ? "schedule" : "send",
      resource: "campaign",
      resourceId: id,
      diff: { recipients: recipientCount },
    },
  });
  revalidatePath(`/app/campaigns/${id}`);
  revalidatePath("/app/campaigns");
  return { ok: true, recipients: recipientCount };
}

/**
 * Mock test send. Logs an audit event so QA can verify the codepath; no real
 * email is delivered without a configured transport.
 */
export async function sendTestCampaignAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "send");
  const testEmail = String(fd.get("testEmail") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail)) {
    return { error: "Enter a valid email address" };
  }
  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!campaign) return { error: "Not found" };
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "test-send",
      resource: "campaign",
      resourceId: id,
      diff: { to: testEmail },
    },
  });
  return { ok: true };
}

export async function cancelCampaignAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "campaign", "edit");
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) return { error: "Not found" };
  if (existing.status !== CampaignStatus.SCHEDULED) {
    return { error: "Only scheduled campaigns can be cancelled" };
  }
  await prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.CANCELLED, scheduledAt: null },
  });
  revalidatePath(`/app/campaigns/${id}`);
  return { ok: true };
}
