"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  generatePortalToken,
  portalAccessSchema,
} from "@/modules/portal/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function issuePortalLinkAction(customerId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "portal", "create");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");

  const data = portalAccessSchema.parse({
    label: s(fd, "label"),
    expiresAt: s(fd, "expiresAt"),
  });

  const created = await prisma.portalAccess.create({
    data: {
      workspaceId: ctx.workspaceId,
      customerId,
      token: generatePortalToken(),
      label: data.label || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
    select: { id: true, token: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "portal.issue",
    resource: "portal",
    resourceId: created.id,
    diff: { customerId, label: data.label || null },
  });

  revalidatePath(`/app/billing/customers/${customerId}/portal`);
}

export async function revokePortalLinkAction(linkId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "portal", "delete");

  const link = await prisma.portalAccess.findFirst({
    where: { id: linkId, workspaceId: ctx.workspaceId },
    select: { id: true, customerId: true, revokedAt: true },
  });
  if (!link) throw new Error("Link not found");
  if (link.revokedAt) return;

  await prisma.portalAccess.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "portal.revoke",
    resource: "portal",
    resourceId: linkId,
  });

  revalidatePath(`/app/billing/customers/${link.customerId}/portal`);
}
