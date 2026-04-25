"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { activitySchema } from "@/modules/crm/schemas";

export async function createActivityAction(fd: FormData) {
  const ctx = await requireSession();
  // Activities are scoped to whichever resource they belong to.
  // For now: any user who can edit a contact can log an activity on it.
  assertCan(ctx.role, "contact", "edit");

  const parsed = activitySchema.safeParse({
    type: fd.get("type"),
    subject: fd.get("subject") ?? "",
    body: fd.get("body") ?? "",
    contactId: fd.get("contactId") ?? "",
    dealId: fd.get("dealId") ?? "",
    dueAt: fd.get("dueAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  // Verify the linked contact belongs to this workspace
  if (data.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: data.contactId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!c) return { error: "Contact not found" };
  }
  if (data.dealId) {
    const d = await prisma.deal.findFirst({
      where: { id: data.dealId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!d) return { error: "Deal not found" };
  }

  await prisma.activity.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: data.type,
      subject: data.subject,
      body: data.body,
      contactId: data.contactId,
      dealId: data.dealId,
      authorId: ctx.userId,
      dueAt: data.dueAt,
    },
  });

  if (data.contactId) revalidatePath(`/app/crm/contacts/${data.contactId}`);
  if (data.dealId) revalidatePath(`/app/sales/deals/${data.dealId}`);
  return { ok: true };
}
