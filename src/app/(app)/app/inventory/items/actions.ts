"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { inventoryItemSchema, stockAdjustSchema } from "@/modules/inventory/schemas";
import { recordAuditEvent } from "@/modules/audit/record";
import { applyStockMovement } from "@/modules/inventory/stock";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    sku: fd.get("sku") ?? "",
    description: fd.get("description") ?? "",
    unit: fd.get("unit") ?? "each",
    costPrice: fd.get("costPrice") ?? "0",
    salePrice: fd.get("salePrice") ?? "0",
    reorderPoint: fd.get("reorderPoint") ?? "0",
    trackStock: fd.get("trackStock") === "on" || fd.get("trackStock") === "true",
  };
}

export async function createItemAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "inventoryItem", "create");
  const parsed = inventoryItemSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const dup = await prisma.inventoryItem.findUnique({
    where: { workspaceId_sku: { workspaceId: ctx.workspaceId, sku: parsed.data.sku } },
    select: { id: true },
  });
  if (dup) throw new Error("An item with this SKU already exists");

  const item = await prisma.inventoryItem.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      sku: parsed.data.sku,
      description: parsed.data.description || null,
      unit: parsed.data.unit,
      costPrice: parsed.data.costPrice,
      salePrice: parsed.data.salePrice,
      reorderPoint: parsed.data.reorderPoint,
      trackStock: parsed.data.trackStock,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "inventoryItem",
    resourceId: item.id,
  });
  revalidatePath("/app/inventory/items");
  redirect(`/app/inventory/items/${item.id}`);
}

export async function updateItemAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "inventoryItem", "edit");
  const parsed = inventoryItemSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await prisma.inventoryItem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, sku: true },
  });
  if (!existing) throw new Error("Not found");

  if (existing.sku !== parsed.data.sku) {
    const dup = await prisma.inventoryItem.findUnique({
      where: { workspaceId_sku: { workspaceId: ctx.workspaceId, sku: parsed.data.sku } },
      select: { id: true },
    });
    if (dup) throw new Error("An item with this SKU already exists");
  }

  await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku,
      description: parsed.data.description || null,
      unit: parsed.data.unit,
      costPrice: parsed.data.costPrice,
      salePrice: parsed.data.salePrice,
      reorderPoint: parsed.data.reorderPoint,
      trackStock: parsed.data.trackStock,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "inventoryItem",
    resourceId: id,
  });
  revalidatePath("/app/inventory/items");
  revalidatePath(`/app/inventory/items/${id}`);
}

export async function deleteItemAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "inventoryItem", "delete");
  const existing = await prisma.inventoryItem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.inventoryItem.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "inventoryItem",
    resourceId: id,
  });
  revalidatePath("/app/inventory/items");
  redirect("/app/inventory/items");
}

export async function adjustStockAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "inventoryItem", "edit");
  const parsed = stockAdjustSchema.safeParse({
    itemId: fd.get("itemId") ?? "",
    warehouseId: fd.get("warehouseId") ?? "",
    delta: fd.get("delta") ?? "0",
    note: fd.get("note") ?? "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  // Confirm both belong to this workspace
  const [item, warehouse] = await Promise.all([
    prisma.inventoryItem.findFirst({
      where: { id: parsed.data.itemId, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
    prisma.warehouse.findFirst({
      where: { id: parsed.data.warehouseId, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
  ]);
  if (!item || !warehouse) throw new Error("Invalid item or warehouse");
  if (parsed.data.delta === 0) throw new Error("Adjustment cannot be zero");

  await applyStockMovement({
    workspaceId: ctx.workspaceId,
    itemId: parsed.data.itemId,
    warehouseId: parsed.data.warehouseId,
    type: "ADJUST",
    delta: parsed.data.delta,
    note: parsed.data.note || undefined,
    actorId: ctx.userId,
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "stock_adjust",
    resource: "inventoryItem",
    resourceId: parsed.data.itemId,
    diff: { delta: parsed.data.delta, warehouseId: parsed.data.warehouseId },
  });
  revalidatePath(`/app/inventory/items/${parsed.data.itemId}`);
}
