"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { contactSchema } from "@/modules/crm/schemas";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";

function fdToObj(fd: FormData) {
  return {
    firstName: fd.get("firstName") ?? "",
    lastName: fd.get("lastName") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    title: fd.get("title") ?? "",
    companyId: fd.get("companyId") ?? "",
    ownerId: fd.get("ownerId") ?? "",
    lifecycleStage: (fd.get("lifecycleStage") as string) || "LEAD",
    source: fd.get("source") ?? "",
    tags: fd.get("tags") ?? "",
    notes: fd.get("notes") ?? "",
  };
}

export async function createContactAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "contact", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "contacts");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const parsed = contactSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const data = parsed.data;
  const contact = await prisma.contact.create({
    data: {
      workspaceId: ctx.workspaceId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      title: data.title,
      companyId: data.companyId,
      lifecycleStage: data.lifecycleStage,
      source: data.source,
      tags: data.tags,
      notes: data.notes,
      ownerId: data.ownerId ?? ctx.userId,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "contact",
      resourceId: contact.id,
    },
  });
  revalidatePath("/app/crm/contacts");
  redirect(`/app/crm/contacts/${contact.id}`);
}

export async function updateContactAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "contact", "edit");
  const parsed = contactSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };

  const data = parsed.data;
  await prisma.contact.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      title: data.title,
      companyId: data.companyId,
      ownerId: data.ownerId,
      lifecycleStage: data.lifecycleStage,
      source: data.source,
      tags: data.tags,
      notes: data.notes,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "contact",
      resourceId: id,
    },
  });
  revalidatePath(`/app/crm/contacts/${id}`);
  revalidatePath("/app/crm/contacts");
  return { ok: true };
}

export async function deleteContactAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "contact", "delete");
  const existing = await prisma.contact.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.contact.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "contact",
      resourceId: id,
    },
  });
  revalidatePath("/app/crm/contacts");
  redirect("/app/crm/contacts");
}
