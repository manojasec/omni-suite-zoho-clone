/**
 * Inventory auto-reorder engine.
 *
 * Computes which items need replenishment based on current stock levels vs.
 * `reorderPoint`, then groups suggestions by supplier to minimise PO count.
 *
 * Pure functions; an outer service (`scheduleAutoReorder`) wires it into the
 * job queue + DB.
 */

export type ReorderItem = {
  id: string;
  sku: string;
  name: string;
  reorderPoint: number;
  /** Optional preferred supplier — controls grouping. */
  preferredSupplierId?: string | null;
  /** Last known unit cost; copied onto PO lines. */
  costPrice: number;
  /** Optional default warehouse for receiving. */
  defaultWarehouseId?: string | null;
};

export type StockSnapshot = {
  itemId: string;
  warehouseId: string;
  quantity: number;
};

export type ReorderSuggestion = {
  itemId: string;
  warehouseId: string;
  /** Quantity short of the reorder point (>=1). */
  shortBy: number;
  /** Suggested order quantity (defaults to 2× shortfall, min 1). */
  suggestedQty: number;
  unitCost: number;
  supplierId: string | null;
};

export type SupplierGroup = {
  supplierId: string | null;
  suggestions: ReorderSuggestion[];
  estimatedTotal: number;
};

/**
 * Total each item's quantity across warehouses, then flag those whose total
 * has fallen *to or below* `reorderPoint`. Items with `reorderPoint <= 0`
 * are skipped (auto-reorder disabled).
 */
export function findItemsNeedingReorder(
  items: ReorderItem[],
  stock: StockSnapshot[],
  opts: { reorderMultiplier?: number } = {},
): ReorderSuggestion[] {
  const multiplier = opts.reorderMultiplier ?? 2;
  const totalsByItem = new Map<string, number>();
  for (const s of stock) {
    totalsByItem.set(s.itemId, (totalsByItem.get(s.itemId) ?? 0) + s.quantity);
  }
  const out: ReorderSuggestion[] = [];
  for (const item of items) {
    if (item.reorderPoint <= 0) continue;
    const total = totalsByItem.get(item.id) ?? 0;
    if (total > item.reorderPoint) continue;
    const shortBy = item.reorderPoint - total + 1; // restore to 1 above point
    const suggestedQty = Math.max(shortBy, item.reorderPoint * multiplier);
    out.push({
      itemId: item.id,
      warehouseId: item.defaultWarehouseId ?? "",
      shortBy,
      suggestedQty,
      unitCost: item.costPrice,
      supplierId: item.preferredSupplierId ?? null,
    });
  }
  return out;
}

/** Group reorder suggestions by supplier so each group becomes one PO. */
export function groupBySupplier(suggestions: ReorderSuggestion[]): SupplierGroup[] {
  const map = new Map<string, ReorderSuggestion[]>();
  for (const s of suggestions) {
    const key = s.supplierId ?? "__unassigned__";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()].map(([key, list]) => ({
    supplierId: key === "__unassigned__" ? null : key,
    suggestions: list,
    estimatedTotal: list.reduce((sum, s) => sum + s.unitCost * s.suggestedQty, 0),
  }));
}

/** Generate a deterministic PO number from a counter + workspace prefix. */
export function nextPoNumber(prefix: string, counter: number): string {
  return `${prefix}-${String(counter).padStart(5, "0")}`;
}

export const REORDER_JOB_KIND = "inventory.reorder.scan";
