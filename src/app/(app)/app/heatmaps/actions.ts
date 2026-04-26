"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  HEATMAP_SITE_STATUSES,
  SESSION_RECORDING_STATUSES,
  canTransitionRecording,
  generateTrackerKey,
  heatmapPageSchema,
  heatmapSiteSchema,
  normalizePath,
} from "@/modules/heatmaps/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------------- Sites ----------------

export async function createHeatmapSiteAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "create");
  const data = heatmapSiteSchema.parse(toFormObject(fd));

  let site;
  try {
    site = await prisma.heatmapSite.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        domain: data.domain,
        status: data.status,
        sampleRate: data.sampleRate,
        trackerKey: generateTrackerKey(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A heatmap site for "${data.domain}" already exists`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "heatmapSite",
    resourceId: site.id,
    diff: { domain: site.domain },
  });
  revalidatePath("/app/heatmaps");
  redirect(`/app/heatmaps/${site.id}`);
}

export async function updateHeatmapSiteAction(siteId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "edit");
  const site = await prisma.heatmapSite.findFirst({
    where: { id: siteId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!site) throw new Error("Heatmap site not found");

  const data = heatmapSiteSchema.parse(toFormObject(fd));
  try {
    await prisma.heatmapSite.update({
      where: { id: siteId },
      data: {
        name: data.name,
        domain: data.domain,
        status: data.status,
        sampleRate: data.sampleRate,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A heatmap site for "${data.domain}" already exists`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "heatmapSite",
    resourceId: siteId,
  });
  revalidatePath(`/app/heatmaps/${siteId}`);
  revalidatePath("/app/heatmaps");
}

export async function toggleHeatmapSiteStatusAction(siteId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "edit");
  const next = s(fd, "to");
  if (!HEATMAP_SITE_STATUSES.includes(next as (typeof HEATMAP_SITE_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const site = await prisma.heatmapSite.findFirst({
    where: { id: siteId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!site) throw new Error("Heatmap site not found");
  if (site.status === next) return;

  await prisma.heatmapSite.update({
    where: { id: siteId },
    data: { status: next as (typeof HEATMAP_SITE_STATUSES)[number] },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "heatmapSite",
    resourceId: siteId,
    diff: { from: site.status, to: next },
  });
  revalidatePath(`/app/heatmaps/${siteId}`);
  revalidatePath("/app/heatmaps");
}

export async function rotateTrackerKeyAction(siteId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "edit");
  const site = await prisma.heatmapSite.findFirst({
    where: { id: siteId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!site) throw new Error("Heatmap site not found");
  const key = generateTrackerKey();
  await prisma.heatmapSite.update({
    where: { id: siteId },
    data: { trackerKey: key },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "heatmapSite",
    resourceId: siteId,
    diff: { trackerKey: "rotated" },
  });
  revalidatePath(`/app/heatmaps/${siteId}`);
}

export async function deleteHeatmapSiteAction(siteId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "delete");
  const site = await prisma.heatmapSite.findFirst({
    where: { id: siteId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!site) throw new Error("Heatmap site not found");
  if (site.status === "ACTIVE") {
    throw new Error("Pause the site before deleting it");
  }
  await prisma.heatmapSite.delete({ where: { id: siteId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "heatmapSite",
    resourceId: siteId,
  });
  revalidatePath("/app/heatmaps");
  redirect("/app/heatmaps");
}

// ---------------- Pages ----------------

export async function createHeatmapPageAction(siteId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapPage", "create");
  const site = await prisma.heatmapSite.findFirst({
    where: { id: siteId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!site) throw new Error("Heatmap site not found");

  const data = heatmapPageSchema.parse(toFormObject(fd));
  const path = normalizePath(data.path);

  try {
    await prisma.heatmapPage.create({
      data: {
        siteId: site.id,
        path,
        label: data.label,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`Path "${path}" is already tracked on this site`);
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "heatmapPage",
    resourceId: site.id,
    diff: { siteId: site.id, path },
  });
  revalidatePath(`/app/heatmaps/${site.id}`);
}

export async function deleteHeatmapPageAction(pageId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapPage", "delete");
  const page = await prisma.heatmapPage.findFirst({
    where: { id: pageId, site: { workspaceId: ctx.workspaceId } },
    select: { id: true, siteId: true },
  });
  if (!page) throw new Error("Page not found");
  await prisma.heatmapPage.delete({ where: { id: pageId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "heatmapPage",
    resourceId: pageId,
  });
  revalidatePath(`/app/heatmaps/${page.siteId}`);
}

// ---------------- Recordings ----------------

export async function transitionRecordingAction(
  recordingId: string,
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sessionRecording", "edit");
  const next = s(fd, "to");
  if (
    !SESSION_RECORDING_STATUSES.includes(
      next as (typeof SESSION_RECORDING_STATUSES)[number],
    )
  ) {
    throw new Error("Invalid target status");
  }
  const recording = await prisma.sessionRecording.findFirst({
    where: { id: recordingId, site: { workspaceId: ctx.workspaceId } },
    select: { id: true, status: true, siteId: true, startedAt: true },
  });
  if (!recording) throw new Error("Recording not found");
  if (
    !canTransitionRecording(
      recording.status,
      next as (typeof SESSION_RECORDING_STATUSES)[number],
    )
  ) {
    throw new Error(`Cannot transition from ${recording.status} to ${next}`);
  }

  const update: Prisma.SessionRecordingUpdateInput = {
    status: next as (typeof SESSION_RECORDING_STATUSES)[number],
  };
  if (next === "COMPLETED") {
    const now = new Date();
    update.endedAt = now;
    update.durationMs = now.getTime() - recording.startedAt.getTime();
  }
  await prisma.sessionRecording.update({
    where: { id: recordingId },
    data: update,
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "sessionRecording",
    resourceId: recordingId,
    diff: { from: recording.status, to: next },
  });
  revalidatePath(`/app/heatmaps/recordings/${recordingId}`);
  revalidatePath("/app/heatmaps/recordings");
}

export async function deleteRecordingAction(recordingId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sessionRecording", "delete");
  const recording = await prisma.sessionRecording.findFirst({
    where: { id: recordingId, site: { workspaceId: ctx.workspaceId } },
    select: { id: true, status: true },
  });
  if (!recording) throw new Error("Recording not found");
  if (recording.status === "RECORDING") {
    throw new Error("Stop the recording before deleting it");
  }
  await prisma.sessionRecording.delete({ where: { id: recordingId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "sessionRecording",
    resourceId: recordingId,
  });
  revalidatePath("/app/heatmaps/recordings");
  redirect("/app/heatmaps/recordings");
}
