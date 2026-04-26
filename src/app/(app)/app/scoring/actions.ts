"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  ruleSchema,
  manualEventSchema,
  DEFAULT_POINTS,
  type LeadScoreEventType,
} from "@/modules/scoring/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

export async function createRuleAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreRule", "create");
  const parsed = ruleSchema.safeParse({
    name: s(fd, "name"),
    eventType: s(fd, "eventType"),
    points: s(fd, "points"),
    active: s(fd, "active") === "on" || s(fd, "active") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const rule = await prisma.leadScoreRule.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      eventType: parsed.data.eventType,
      points: parsed.data.points,
      active: parsed.data.active ?? true,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "leadScoreRule",
    resourceId: rule.id,
    diff: { after: { name: rule.name, eventType: rule.eventType, points: rule.points } },
  });
  revalidatePath("/app/scoring");
}

export async function toggleRuleAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreRule", "edit");
  const rule = await prisma.leadScoreRule.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!rule) throw new Error("Rule not found");
  await prisma.leadScoreRule.update({ where: { id }, data: { active: !rule.active } });
  revalidatePath("/app/scoring");
}

export async function deleteRuleAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreRule", "delete");
  const rule = await prisma.leadScoreRule.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!rule) throw new Error("Rule not found");
  await prisma.leadScoreRule.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "leadScoreRule",
    resourceId: id,
  });
  revalidatePath("/app/scoring");
}

export async function recordManualEventAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreEvent", "create");
  const parsed = manualEventSchema.safeParse({
    contactId: s(fd, "contactId"),
    points: s(fd, "points"),
    reason: s(fd, "reason"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const contact = await prisma.contact.findFirst({
    where: { id: parsed.data.contactId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!contact) throw new Error("Contact not found");

  await prisma.leadScoreEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId: contact.id,
      eventType: "MANUAL",
      points: parsed.data.points,
      reason: parsed.data.reason ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "leadScoreEvent",
    resourceId: contact.id,
    diff: { points: parsed.data.points, reason: parsed.data.reason ?? null },
  });
  revalidatePath("/app/scoring");
  revalidatePath(`/app/scoring/contacts/${contact.id}`);
}

/**
 * Internal helper for other modules to record events programmatically.
 * Looks up the most-recent active rule for the eventType and uses its points
 * (falling back to DEFAULT_POINTS). Returns the created event id, or null when
 * scoring is suppressed (no active rule and not MANUAL).
 */
export async function recordScoreEvent(opts: {
  workspaceId: string;
  contactId: string;
  eventType: LeadScoreEventType;
  reason?: string;
  pointsOverride?: number;
}): Promise<string | null> {
  const rule = opts.eventType === "MANUAL"
    ? null
    : await prisma.leadScoreRule.findFirst({
        where: { workspaceId: opts.workspaceId, eventType: opts.eventType, active: true },
        orderBy: { createdAt: "desc" },
      });
  // If automated (non-MANUAL) and no active rule exists, skip silently.
  if (opts.eventType !== "MANUAL" && !rule) return null;

  const points = opts.pointsOverride ?? rule?.points ?? DEFAULT_POINTS[opts.eventType];
  if (!Number.isFinite(points) || points === 0) return null;

  const ev = await prisma.leadScoreEvent.create({
    data: {
      workspaceId: opts.workspaceId,
      contactId: opts.contactId,
      ruleId: rule?.id ?? null,
      eventType: opts.eventType,
      points,
      reason: opts.reason ?? null,
    },
  });
  return ev.id;
}

export async function deleteEventAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreEvent", "delete");
  const ev = await prisma.leadScoreEvent.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, contactId: true },
  });
  if (!ev) throw new Error("Event not found");
  await prisma.leadScoreEvent.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "leadScoreEvent",
    resourceId: id,
  });
  revalidatePath("/app/scoring");
  revalidatePath(`/app/scoring/contacts/${ev.contactId}`);
}

/** Redirects to the contact's score detail page (used by a small form). */
export async function viewContactScoreAction(fd: FormData) {
  const id = s(fd, "contactId");
  if (!id) throw new Error("Pick a contact");
  redirect(`/app/scoring/contacts/${id}`);
}
