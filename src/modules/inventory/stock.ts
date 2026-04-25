import "server-only";
import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@prisma/client";

/**
 * Apply a stock movement and update the corresponding StockLevel atomically.
 * `delta` is signed: positive adds stock, negative removes.
 */
export async function applyStockMovement(args: {
  workspaceId: string;
  itemId: string;
  warehouseId: string;
  type: StockMovementType;
  delta: number;
  reference?: string;
  note?: string;
  actorId?: string;
}) {
  const {
    workspaceId,
    itemId,
    warehouseId,
    type,
    delta,
    reference,
    note,
    actorId,
  } = args;

  if (delta === 0) return;

  return prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({
      data: {
        workspaceId,
        itemId,
        warehouseId,
        type,
        quantity: delta,
        reference,
        note,
        actorId,
      },
    });

    const existing = await tx.stockLevel.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      select: { quantity: true },
    });

    if (existing) {
      await tx.stockLevel.update({
        where: { itemId_warehouseId: { itemId, warehouseId } },
        data: { quantity: existing.quantity + delta },
      });
    } else {
      await tx.stockLevel.create({
        data: { itemId, warehouseId, quantity: delta },
      });
    }
  });
}
