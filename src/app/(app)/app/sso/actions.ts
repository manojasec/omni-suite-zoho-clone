"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  SSO_LOGIN_KINDS,
  SSO_PROVIDER_STATUSES,
  canTransitionSsoProvider,
  ssoProviderSchema,
  validateCertificate,
} from "@/modules/sso/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
  return out;
}

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

export async function createSsoProviderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "create");
  const data = ssoProviderSchema.parse(toFormObject(fd));

  const certCheck = validateCertificate(data.certificate);
  if (!certCheck.ok) throw new Error(`Certificate invalid: ${certCheck.reason}`);

  let created;
  try {
    created = await prisma.ssoProvider.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        protocol: data.protocol,
        status: data.status,
        domain: data.domain,
        entityId: data.entityId,
        ssoUrl: data.ssoUrl,
        sloUrl: data.sloUrl,
        certificate: data.certificate,
        emailAttr: data.emailAttr,
        nameAttr: data.nameAttr,
        defaultRole: data.defaultRole,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Provider name or domain already in use in this workspace");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "ssoProvider",
    resourceId: created.id,
    diff: { name: created.name, protocol: created.protocol },
  });
  revalidatePath("/app/sso");
  redirect(`/app/sso/${created.id}`);
}

export async function updateSsoProviderAction(providerId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "edit");
  const provider = await prisma.ssoProvider.findFirst({
    where: { id: providerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!provider) throw new Error("Provider not found");

  const data = ssoProviderSchema.parse(toFormObject(fd));
  const certCheck = validateCertificate(data.certificate);
  if (!certCheck.ok) throw new Error(`Certificate invalid: ${certCheck.reason}`);

  try {
    await prisma.ssoProvider.update({
      where: { id: providerId },
      data: {
        name: data.name,
        protocol: data.protocol,
        status: data.status,
        domain: data.domain,
        entityId: data.entityId,
        ssoUrl: data.ssoUrl,
        sloUrl: data.sloUrl,
        certificate: data.certificate,
        emailAttr: data.emailAttr,
        nameAttr: data.nameAttr,
        defaultRole: data.defaultRole,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Provider name or domain already in use in this workspace");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "ssoProvider",
    resourceId: providerId,
  });
  revalidatePath(`/app/sso/${providerId}`);
  revalidatePath("/app/sso");
}

export async function transitionSsoProviderAction(
  providerId: string,
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "manage");
  const next = s(fd, "to");
  if (!SSO_PROVIDER_STATUSES.includes(next as (typeof SSO_PROVIDER_STATUSES)[number])) {
    throw new Error("Invalid target status");
  }
  const provider = await prisma.ssoProvider.findFirst({
    where: { id: providerId, workspaceId: ctx.workspaceId },
  });
  if (!provider) throw new Error("Provider not found");
  if (
    !canTransitionSsoProvider(
      provider.status,
      next as (typeof SSO_PROVIDER_STATUSES)[number],
    )
  ) {
    throw new Error(`Cannot transition from ${provider.status} to ${next}`);
  }

  if (next === "ACTIVE") {
    if (!provider.certificate || !provider.certificate.trim()) {
      throw new Error("Cannot activate a provider without a certificate");
    }
    if (!provider.domain) {
      throw new Error("Cannot activate a provider without a claimed domain");
    }
  }

  await prisma.ssoProvider.update({
    where: { id: providerId },
    data: { status: next as (typeof SSO_PROVIDER_STATUSES)[number] },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "ssoProvider",
    resourceId: providerId,
    diff: { from: provider.status, to: next },
  });
  revalidatePath(`/app/sso/${providerId}`);
  revalidatePath("/app/sso");
}

export async function deleteSsoProviderAction(providerId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "delete");
  const provider = await prisma.ssoProvider.findFirst({
    where: { id: providerId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!provider) throw new Error("Provider not found");
  if (provider.status === "ACTIVE") {
    throw new Error("Disable the provider before deleting it");
  }
  await prisma.ssoProvider.delete({ where: { id: providerId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "ssoProvider",
    resourceId: providerId,
  });
  revalidatePath("/app/sso");
  redirect("/app/sso");
}

/**
 * Internal helper used by login flows / tests to record an SSO login event.
 * Not exposed to clients via a form; bound at server-side call sites.
 */
export async function logSsoEventAction(input: {
  providerId: string;
  email: string;
  kind: (typeof SSO_LOGIN_KINDS)[number];
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const ctx = await requireSession();
  const provider = await prisma.ssoProvider.findFirst({
    where: { id: input.providerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!provider) throw new Error("Provider not found");
  await prisma.ssoLoginEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      providerId: provider.id,
      email: input.email.toLowerCase(),
      kind: input.kind,
      reason: input.reason ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  revalidatePath("/app/sso/events");
}
