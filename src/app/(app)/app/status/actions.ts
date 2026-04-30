"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  componentSchema,
  incidentSchema,
  incidentUpdateSchema,
  COMPONENT_STATES,
  type ComponentState,
} from "@/modules/status/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

// ===== Components =====

export async function createComponentAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "create");

  const parsed = componentSchema.safeParse({
    name: s(fd, "name"),
    description: s(fd, "description"),
    state: s(fd, "state") || "OPERATIONAL",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const last = await prisma.statusComponent.findFirst({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.statusComponent.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      state: parsed.data.state,
      position: (last?.position ?? -1) + 1,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "statusPage.component.create",
    resource: "statusComponent",
    resourceId: created.id,
    diff: parsed.data,
  });

  revalidatePath("/app/status");
}

export async function setComponentStateAction(componentId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "edit");

  const next = s(fd, "state") as ComponentState;
  if (!COMPONENT_STATES.includes(next)) throw new Error("Invalid state");

  const existing = await prisma.statusComponent.findFirst({
    where: { id: componentId, workspaceId: ctx.workspaceId },
    select: { id: true, state: true },
  });
  if (!existing) throw new Error("Component not found");
  if (existing.state === next) {
    revalidatePath("/app/status");
    return;
  }

  await prisma.statusComponent.update({
    where: { id: componentId },
    data: { state: next },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "statusPage.component.setState",
    resource: "statusComponent",
    resourceId: componentId,
    diff: { from: existing.state, to: next },
  });

  revalidatePath("/app/status");
}

export async function deleteComponentAction(componentId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "delete");

  const existing = await prisma.statusComponent.findFirst({
    where: { id: componentId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Component not found");

  await prisma.statusComponent.delete({ where: { id: componentId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "statusPage.component.delete",
    resource: "statusComponent",
    resourceId: componentId,
  });

  revalidatePath("/app/status");
}

// ===== Incidents =====

export async function createIncidentAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "create");

  const parsed = incidentSchema.safeParse({
    title: s(fd, "title"),
    state: s(fd, "state") || "INVESTIGATING",
    impact: s(fd, "impact") || "MINOR",
    body: s(fd, "body"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const created = await prisma.statusIncident.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: parsed.data.title,
      state: parsed.data.state,
      impact: parsed.data.impact,
      resolvedAt: parsed.data.state === "RESOLVED" ? new Date() : null,
      updates: {
        create: {
          state: parsed.data.state,
          body: parsed.data.body,
        },
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "statusPage.incident.create",
    resource: "statusIncident",
    resourceId: created.id,
    diff: { title: parsed.data.title, state: parsed.data.state, impact: parsed.data.impact },
  });

  revalidatePath("/app/status");
  redirect(`/app/status/incidents/${created.id}`);
}

export async function postIncidentUpdateAction(incidentId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "edit");

  const parsed = incidentUpdateSchema.safeParse({
    state: s(fd, "state"),
    body: s(fd, "body"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const incident = await prisma.statusIncident.findFirst({
    where: { id: incidentId, workspaceId: ctx.workspaceId },
    select: { id: true, state: true, resolvedAt: true },
  });
  if (!incident) throw new Error("Incident not found");

  await prisma.$transaction([
    prisma.statusIncidentUpdate.create({
      data: {
        incidentId,
        state: parsed.data.state,
        body: parsed.data.body,
      },
    }),
    prisma.statusIncident.update({
      where: { id: incidentId },
      data: {
        state: parsed.data.state,
        resolvedAt:
          parsed.data.state === "RESOLVED"
            ? incident.resolvedAt ?? new Date()
            : parsed.data.state === incident.state
              ? incident.resolvedAt
              : null,
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "statusPage.incident.update",
    resource: "statusIncident",
    resourceId: incidentId,
    diff: { from: incident.state, to: parsed.data.state },
  });

  revalidatePath("/app/status");
  revalidatePath(`/app/status/incidents/${incidentId}`);
}
