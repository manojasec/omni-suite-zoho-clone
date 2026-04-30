"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { emailTemplateSchema } from "@/modules/email-templates/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

function parse(fd: FormData) {
  return emailTemplateSchema.parse({
    name: s(fd, "name"),
    category: s(fd, "category"),
    subject: s(fd, "subject"),
    bodyText: s(fd, "bodyText"),
    bodyHtml: s(fd, "bodyHtml"),
    isActive: fd.get("isActive") === "on",
  });
}

export async function createEmailTemplateAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "create");
  const data = parse(fd);

  const created = await prisma.emailTemplate.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      category: data.category,
      subject: data.subject,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml || null,
      isActive: data.isActive,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "emailTemplate.create",
    resource: "emailTemplate",
    resourceId: created.id,
    diff: { name: data.name, category: data.category },
  });

  revalidatePath("/app/email-templates");
  redirect(`/app/email-templates/${created.id}`);
}

export async function updateEmailTemplateAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "edit");
  const data = parse(fd);

  const existing = await prisma.emailTemplate.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Template not found");

  await prisma.emailTemplate.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      subject: data.subject,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml || null,
      isActive: data.isActive,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "emailTemplate.edit",
    resource: "emailTemplate",
    resourceId: id,
  });

  revalidatePath("/app/email-templates");
  revalidatePath(`/app/email-templates/${id}`);
}

export async function deleteEmailTemplateAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "delete");

  const existing = await prisma.emailTemplate.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Template not found");

  await prisma.emailTemplate.delete({ where: { id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "emailTemplate.delete",
    resource: "emailTemplate",
    resourceId: id,
  });

  revalidatePath("/app/email-templates");
  redirect("/app/email-templates");
}
