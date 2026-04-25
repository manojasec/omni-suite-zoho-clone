"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { purchaseOrderSchema, computePOTotals } from "@/modules/inventory/schemas";
import { recordAuditEvent } from "@/modules/audit/record";
import { applyStockMovement } from "@/modules/inventory/stock";

function parseLines(fd: FormData) {
  // Lines come in as line[i][field]
  const lines: Array<{
    itemId: string;
    warehouseId: string;
    description: string;
    qtyOrdered: string;
    unitCost: string;
    taxPercent: string;
  }> = [];
  const indices = new Set<number>();
  for (const key of fd.keys()) {
    const m = key.match(/^line\[(\d+)\]/);
    if (m) indices.add(Number(m[1]));
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const itemId = String(fd.get(`line[${i}][itemId]`) ?? "");
    if (!itemId) continue;
    lines.push({
      itemId,
      warehouseId: String(fd.get(`line[${i}][warehouseId]`) ?? ""),
      description: String(fd.get(`line[${i}][description]`) ?? ""),
      qtyOrdered: String(fd.get(`line[${i}][qtyOrdered]`) ?? "0"),
      unitCost: String(fd.get(`line[${i}][unitCost]`) ?? "0"),
      taxPercent: String(fd.get(`line[${i}][taxPercent]`) ?? "0"),
    });
  }
  return lines;
}

async function nextPONumber(workspaceId: string) {
  const latest = await prisma.purchaseOrder.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });
  const n = latest ? parseInt(latest.number.replace(/\D/g, ""), 10) || 0 : 0;
  return `PO-${String(n + 1).padStart(5, "0")}`;
}

export async function createPurchaseOrderAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "purchaseOrder", "create");

  const parsed = purchaseOrderSchema.safeParse({
    supplierId: fd.get("supplierId") ?? "",
    orderDate: fd.get("orderDate") || new Date().toISOString().slice(0, 10),
    expectedDate: fd.get("expectedDate") || undefined,
    currency: fd.get("currency") || "USD",
    notes: fd.get("notes") || "",
    lines: parseLines(fd),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supplier = await prisma.supplier.findFirst({
    where: { id: parsed.data.supplierId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!supplier) return { error: "Supplier not found" };

  // Validate items + warehouses belong to this workspace
  const itemIds = [...new Set(parsed.data.lines.map((l) => l.itemId))];
  const whIds = [...new Set(parsed.data.lines.map((l) => l.warehouseId))];
  const [items, whs] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
    prisma.warehouse.findMany({
      where: { id: { in: whIds }, workspaceId: ctx.workspaceId },
      select: { id: true },
    }),
  ]);
  if (items.length !== itemIds.length) return { error: "Invalid item on a line" };
  if (whs.length !== whIds.length) return { error: "Invalid warehouse on a line" };

  const totals = computePOTotals(parsed.data.lines);

  const number = await nextPONumber(ctx.workspaceId);

  const po = await prisma.purchaseOrder.create({
    data: {
      workspaceId: ctx.workspaceId,
      number,
      supplierId: parsed.data.supplierId,
      status: "DRAFT",
      orderDate: new Date(parsed.data.orderDate),
      expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : null,
      currency: parsed.data.currency,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      notes: parsed.data.notes || null,
      lines: {
        create: parsed.data.lines.map((l) => {
          const qty = l.qtyOrdered;
          const cost = l.unitCost;
          const tax = (qty * cost * l.taxPercent) / 100;
          const amount = qty * cost + tax;
          return {
            itemId: l.itemId,
            warehouseId: l.warehouseId,
            description: l.description,
            qtyOrdered: qty,
            qtyReceived: 0,
            unitCost: cost,
            taxPercent: l.taxPercent,
            amount: Number(amount.toFixed(2)),
          };
        }),
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "purchaseOrder",
    resourceId: po.id,
  });
  revalidatePath("/app/inventory/purchase-orders");
  redirect(`/app/inventory/purchase-orders/${po.id}`);
}

export async function sendPurchaseOrderAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "purchaseOrder", "send");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!po) throw new Error("Not found");
  if (po.status !== "DRAFT") throw new Error("Already sent");
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "SENT" },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "send",
    resource: "purchaseOrder",
    resourceId: id,
  });
  revalidatePath(`/app/inventory/purchase-orders/${id}`);
  revalidatePath("/app/inventory/purchase-orders");
}

export async function receivePurchaseOrderAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "purchaseOrder", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { lines: true },
  });
  if (!po) throw new Error("Not found");
  if (po.status === "DRAFT" || po.status === "CANCELLED" || po.status === "RECEIVED") {
    throw new Error("Cannot receive in current status");
  }

  // Each line: receive[lineId] = qty to receive now
  let touched = 0;
  for (const line of po.lines) {
    const raw = fd.get(`receive[${line.id}]`);
    const qty = Math.floor(Number(raw ?? 0));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const remaining = line.qtyOrdered - line.qtyReceived;
    const apply = Math.min(qty, remaining);
    if (apply <= 0) continue;
    await applyStockMovement({
      workspaceId: ctx.workspaceId,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
      type: "RECEIVE",
      delta: apply,
      reference: po.number,
      actorId: ctx.userId,
    });
    await prisma.purchaseOrderLine.update({
      where: { id: line.id },
      data: { qtyReceived: line.qtyReceived + apply },
    });
    touched += apply;
  }

  if (touched === 0) throw new Error("No quantities to receive");

  // Recompute status
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrderId: id },
    select: { qtyOrdered: true, qtyReceived: true },
  });
  const allReceived = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
  const anyReceived = lines.some((l) => l.qtyReceived > 0);
  const newStatus = allReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status;
  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: newStatus,
      receivedDate: allReceived ? new Date() : po.receivedDate,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "receive",
    resource: "purchaseOrder",
    resourceId: id,
    diff: { received: touched, status: newStatus },
  });
  revalidatePath(`/app/inventory/purchase-orders/${id}`);
  revalidatePath("/app/inventory/purchase-orders");
}

export async function cancelPurchaseOrderAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "purchaseOrder", "edit");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!po) return;
  if (po.status === "RECEIVED" || po.status === "CANCELLED") return;
  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "cancel",
    resource: "purchaseOrder",
    resourceId: id,
  });
  revalidatePath(`/app/inventory/purchase-orders/${id}`);
  revalidatePath("/app/inventory/purchase-orders");
}

export async function deletePurchaseOrderAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "purchaseOrder", "delete");
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!po) return;
  if (po.status !== "DRAFT" && po.status !== "CANCELLED") return;
  await prisma.purchaseOrder.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "purchaseOrder",
    resourceId: id,
  });
  revalidatePath("/app/inventory/purchase-orders");
  redirect("/app/inventory/purchase-orders");
}
