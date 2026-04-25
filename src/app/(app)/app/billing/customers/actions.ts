"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { customerSchema } from "@/modules/billing/schemas";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    email: fd.get("email") ?? "",
    companyId: fd.get("companyId") ?? "",
    billingAddress: fd.get("billingAddress") ?? "",
    taxId: fd.get("taxId") ?? "",
    currency: (fd.get("currency") as string) || "USD",
  };
}

export async function createCustomerAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "customer", "create");
  const parsed = customerSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const c = await prisma.customer.create({
    data: { workspaceId: ctx.workspaceId, ...parsed.data },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "customer",
      resourceId: c.id,
    },
  });
  revalidatePath("/app/billing/customers");
  redirect(`/app/billing/customers/${c.id}`);
}

export async function updateCustomerAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "customer", "edit");
  const parsed = customerSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const existing = await prisma.customer.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.customer.update({ where: { id }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "customer",
      resourceId: id,
    },
  });
  revalidatePath("/app/billing/customers");
  revalidatePath(`/app/billing/customers/${id}`);
  return { ok: true };
}

export async function deleteCustomerAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "customer", "delete");
  const existing = await prisma.customer.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.customer.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "customer",
      resourceId: id,
    },
  });
  revalidatePath("/app/billing/customers");
  redirect("/app/billing/customers");
}
