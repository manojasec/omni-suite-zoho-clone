import { describe, expect, it } from "vitest";
import {
  computePOTotals,
  inventoryItemSchema,
  purchaseOrderSchema,
  stockAdjustSchema,
  warehouseSchema,
} from "@/modules/inventory/schemas";

describe("inventory/schemas", () => {
  describe("warehouseSchema", () => {
    it("requires a name", () => {
      const r = warehouseSchema.safeParse({ name: "" });
      expect(r.success).toBe(false);
    });

    it("accepts a minimal valid input", () => {
      const r = warehouseSchema.safeParse({ name: "Main" });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.isDefault).toBe(false);
      }
    });
  });

  describe("inventoryItemSchema", () => {
    it("coerces price strings to numbers", () => {
      const r = inventoryItemSchema.safeParse({
        name: "Hoodie",
        sku: "HD-1",
        costPrice: "12.50",
        salePrice: "29.99",
        reorderPoint: "5",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.costPrice).toBe(12.5);
        expect(r.data.salePrice).toBe(29.99);
        expect(r.data.reorderPoint).toBe(5);
        expect(r.data.unit).toBe("each");
        expect(r.data.trackStock).toBe(true);
      }
    });

    it("rejects missing SKU", () => {
      const r = inventoryItemSchema.safeParse({ name: "X", sku: "" });
      expect(r.success).toBe(false);
    });

    it("rejects negative prices", () => {
      const r = inventoryItemSchema.safeParse({
        name: "x",
        sku: "x",
        costPrice: "-1",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("stockAdjustSchema", () => {
    it("accepts negative deltas", () => {
      const r = stockAdjustSchema.safeParse({
        itemId: "i1",
        warehouseId: "w1",
        delta: "-3",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.delta).toBe(-3);
    });

    it("rejects non-integer deltas", () => {
      const r = stockAdjustSchema.safeParse({
        itemId: "i1",
        warehouseId: "w1",
        delta: "1.5",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("purchaseOrderSchema", () => {
    it("requires at least one line", () => {
      const r = purchaseOrderSchema.safeParse({
        supplierId: "s1",
        orderDate: "2025-01-01",
        currency: "USD",
        lines: [],
      });
      expect(r.success).toBe(false);
    });

    it("accepts a minimal valid PO", () => {
      const r = purchaseOrderSchema.safeParse({
        supplierId: "s1",
        orderDate: "2025-01-01",
        currency: "USD",
        lines: [
          {
            itemId: "i1",
            warehouseId: "w1",
            description: "Hoodie",
            qtyOrdered: "10",
            unitCost: "12.5",
            taxPercent: "8",
          },
        ],
      });
      expect(r.success).toBe(true);
    });
  });

  describe("computePOTotals", () => {
    it("returns zeros for empty lines", () => {
      expect(computePOTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
    });

    it("computes subtotal and tax correctly", () => {
      const totals = computePOTotals([
        { itemId: "i1", warehouseId: "w1", description: "x", qtyOrdered: 10, unitCost: 12.5, taxPercent: 10 },
        { itemId: "i2", warehouseId: "w1", description: "y", qtyOrdered: 2, unitCost: 100, taxPercent: 0 },
      ]);
      // 10*12.50 = 125; 2*100 = 200 -> subtotal 325
      // tax = 125 * 0.10 + 200 * 0 = 12.5
      expect(totals.subtotal).toBe(325);
      expect(totals.tax).toBe(12.5);
      expect(totals.total).toBe(337.5);
    });

    it("rounds to 2 decimal places", () => {
      const totals = computePOTotals([
        { itemId: "i1", warehouseId: "w1", description: "x", qtyOrdered: 3, unitCost: 9.99, taxPercent: 7.25 },
      ]);
      // 3 * 9.99 = 29.97; tax = 29.97 * 0.0725 = 2.172825
      expect(totals.subtotal).toBe(29.97);
      expect(totals.tax).toBe(2.17);
      expect(totals.total).toBe(32.14);
    });
  });
});
