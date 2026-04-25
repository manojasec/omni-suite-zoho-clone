"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { warehouseSchema } from "@/modules/inventory/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    code: fd.get("code") ?? "",
    address: fd.get("address") ?? "",
    isDefault: fd.get("isDefault") === "on" || fd.get("isDefault") === "true",
  };
}

export async function createWarehouseAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "warehouse", "create");
  const parsed = warehouseSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { workspaceId: ctx.workspaceId, isDefault: true },
      data: { isDefault: false },
    });
  }
  const w = await prisma.warehouse.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      code: parsed.data.code || null,
      address: parsed.data.address || null,
      isDefault: parsed.data.isDefault,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "warehouse",
    resourceId: w.id,
  });
  revalidatePath("/app/inventory/warehouses");
}

export async function updateWarehouseAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "warehouse", "edit");
  const parsed = warehouseSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await prisma.warehouse.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Not found");

  if (parsed.data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { workspaceId: ctx.workspaceId, isDefault: true, NOT: { id } },
      data: { isDefault: false },
    });
  }
  await prisma.warehouse.update({
    where: { id },
    data: {
      name: parsed.data.name,
      code: parsed.data.code || null,
      address: parsed.data.address || null,
      isDefault: parsed.data.isDefault,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "warehouse",
    resourceId: id,
  });
  revalidatePath("/app/inventory/warehouses");
}

export async function deleteWarehouseAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "warehouse", "delete");
  const existing = await prisma.warehouse.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.warehouse.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "warehouse",
    resourceId: id,
  });
  revalidatePath("/app/inventory/warehouses");
}
