"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { supplierSchema } from "@/modules/inventory/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    address: fd.get("address") ?? "",
    notes: fd.get("notes") ?? "",
  };
}

export async function createSupplierAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "supplier", "create");
  const parsed = supplierSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const s = await prisma.supplier.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "supplier",
    resourceId: s.id,
  });
  revalidatePath("/app/inventory/suppliers");
}

export async function updateSupplierAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "supplier", "edit");
  const parsed = supplierSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const existing = await prisma.supplier.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Not found");
  await prisma.supplier.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "supplier",
    resourceId: id,
  });
  revalidatePath("/app/inventory/suppliers");
}

export async function deleteSupplierAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "supplier", "delete");
  const existing = await prisma.supplier.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.supplier.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "supplier",
    resourceId: id,
  });
  revalidatePath("/app/inventory/suppliers");
}
