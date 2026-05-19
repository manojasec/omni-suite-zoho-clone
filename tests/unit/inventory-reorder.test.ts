import { describe, it, expect } from "vitest";
import {
  findItemsNeedingReorder,
  groupBySupplier,
  nextPoNumber,
  type ReorderItem,
  type StockSnapshot,
} from "@/modules/inventory/reorder";

const items: ReorderItem[] = [
  {
    id: "i1",
    sku: "SKU-001",
    name: "Widget",
    reorderPoint: 10,
    costPrice: 4,
    preferredSupplierId: "sup-a",
    defaultWarehouseId: "wh-1",
  },
  {
    id: "i2",
    sku: "SKU-002",
    name: "Gadget",
    reorderPoint: 5,
    costPrice: 9,
    preferredSupplierId: "sup-b",
    defaultWarehouseId: "wh-1",
  },
  {
    id: "i3",
    sku: "SKU-003",
    name: "Doohickey",
    reorderPoint: 0, // disabled
    costPrice: 1,
  },
  {
    id: "i4",
    sku: "SKU-004",
    name: "Sprocket",
    reorderPoint: 20,
    costPrice: 2,
    preferredSupplierId: null,
    defaultWarehouseId: "wh-1",
  },
];

describe("findItemsNeedingReorder", () => {
  it("flags items at or below reorder point", () => {
    const stock: StockSnapshot[] = [
      { itemId: "i1", warehouseId: "wh-1", quantity: 10 }, // exactly at point
      { itemId: "i2", warehouseId: "wh-1", quantity: 6 }, // above
      { itemId: "i4", warehouseId: "wh-1", quantity: 8 }, // way below
    ];
    const sugg = findItemsNeedingReorder(items, stock);
    const ids = sugg.map((s) => s.itemId).sort();
    expect(ids).toEqual(["i1", "i4"]);
  });

  it("ignores items with reorderPoint <= 0", () => {
    // Even with no stock for i3, reorderPoint = 0 disables auto-reorder.
    const stockOnly3: StockSnapshot[] = [{ itemId: "i3", warehouseId: "wh-1", quantity: 0 }];
    const justI3 = items.filter((i) => i.id === "i3");
    expect(findItemsNeedingReorder(justI3, stockOnly3)).toEqual([]);
  });

  it("computes shortBy and uses 2x multiplier as default suggested qty", () => {
    const stock: StockSnapshot[] = [{ itemId: "i1", warehouseId: "wh-1", quantity: 4 }];
    const sugg = findItemsNeedingReorder(items, stock);
    expect(sugg[0]?.shortBy).toBe(7);
    expect(sugg[0]?.suggestedQty).toBe(20); // max(7, 10*2)
  });

  it("totals stock across multiple warehouses for the same item", () => {
    const stock: StockSnapshot[] = [
      { itemId: "i1", warehouseId: "wh-1", quantity: 6 },
      { itemId: "i1", warehouseId: "wh-2", quantity: 5 },
    ];
    const justI1 = items.filter((i) => i.id === "i1");
    // 11 > 10 → not needed
    expect(findItemsNeedingReorder(justI1, stock)).toEqual([]);
  });
});

describe("groupBySupplier", () => {
  it("groups suggestions and sums per-supplier totals", () => {
    const stock: StockSnapshot[] = [
      { itemId: "i1", warehouseId: "wh-1", quantity: 0 }, // sup-a
      { itemId: "i2", warehouseId: "wh-1", quantity: 0 }, // sup-b
      { itemId: "i4", warehouseId: "wh-1", quantity: 0 }, // unassigned
    ];
    const sugg = findItemsNeedingReorder(items, stock);
    const groups = groupBySupplier(sugg);
    const a = groups.find((g) => g.supplierId === "sup-a");
    const b = groups.find((g) => g.supplierId === "sup-b");
    const u = groups.find((g) => g.supplierId === null);
    expect(a?.suggestions).toHaveLength(1);
    expect(b?.suggestions).toHaveLength(1);
    expect(u?.suggestions).toHaveLength(1);
    // i1: cost 4 * qty 20 = 80
    expect(a?.estimatedTotal).toBe(80);
  });
});

describe("nextPoNumber", () => {
  it("zero-pads to five digits", () => {
    expect(nextPoNumber("PO", 1)).toBe("PO-00001");
    expect(nextPoNumber("PO", 42)).toBe("PO-00042");
    expect(nextPoNumber("RO", 12345)).toBe("RO-12345");
  });
});
