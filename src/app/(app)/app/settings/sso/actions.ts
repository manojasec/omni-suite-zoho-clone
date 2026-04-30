"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  samlConnectionSchema,
  scimTokenSchema,
} from "@/modules/sso/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function saveSamlConnectionAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "samlConnection", "manage");

  const parsed = samlConnectionSchema.parse({
    name: s(fd, "name"),
    idpEntityId: s(fd, "idpEntityId"),
    idpSsoUrl: s(fd, "idpSsoUrl"),
    idpCertificate: s(fd, "idpCertificate"),
    spEntityId: s(fd, "spEntityId"),
  });

  await prisma.samlConnection.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: {
      workspaceId: ctx.workspaceId,
      name: parsed.name,
      idpEntityId: parsed.idpEntityId,
      idpSsoUrl: parsed.idpSsoUrl,
      idpCertificate: parsed.idpCertificate,
      spEntityId: parsed.spEntityId,
      status: "DRAFT",
      createdById: ctx.userId,
    },
    update: {
      name: parsed.name,
      idpEntityId: parsed.idpEntityId,
      idpSsoUrl: parsed.idpSsoUrl,
      idpCertificate: parsed.idpCertificate,
      spEntityId: parsed.spEntityId,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "sso.saml.save",
    resource: "samlConnection",
    diff: { idpEntityId: parsed.idpEntityId, idpSsoUrl: parsed.idpSsoUrl },
  });

  revalidatePath("/app/settings/sso");
}

export async function setSamlStatusAction(
  status: "DRAFT" | "ACTIVE" | "DISABLED",
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "samlConnection", "manage");
  await prisma.samlConnection.update({
    where: { workspaceId: ctx.workspaceId },
    data: { status },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "sso.saml.status",
    resource: "samlConnection",
    diff: { status },
  });
  revalidatePath("/app/settings/sso");
}

export async function createScimTokenAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "scimToken", "create");
  const parsed = scimTokenSchema.parse({ name: s(fd, "name") });

  const token = `scim_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = token.slice(0, 12);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await prisma.scimToken.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.name,
      prefix,
      tokenHash,
      createdById: ctx.userId,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "sso.scim.token.create",
    resource: "scimToken",
    diff: { name: parsed.name, prefix },
  });

  revalidatePath("/app/settings/sso");
  redirect(`/app/settings/sso?newToken=${encodeURIComponent(token)}`);
}

export async function revokeScimTokenAction(tokenId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "scimToken", "delete");
  const t = await prisma.scimToken.findFirst({
    where: { id: tokenId, workspaceId: ctx.workspaceId },
    select: { id: true, revokedAt: true },
  });
  if (!t) throw new Error("Token not found");
  if (t.revokedAt) return;
  await prisma.scimToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "sso.scim.token.revoke",
    resource: "scimToken",
    resourceId: tokenId,
  });
  revalidatePath("/app/settings/sso");
}
