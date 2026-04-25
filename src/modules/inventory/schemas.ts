import { z } from "zod";

const num = z.coerce.number();
const int = z.coerce.number().int();

export const warehouseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().max(2000).optional().or(z.literal("")),
  isDefault: z.coerce.boolean().optional().default(false),
});

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(20).default("each"),
  costPrice: num.min(0).default(0),
  salePrice: num.min(0).default(0),
  reorderPoint: int.min(0).default(0),
  trackStock: z.coerce.boolean().optional().default(true),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const stockAdjustSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  delta: z.coerce.number().int(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const purchaseOrderLineSchema = z.object({
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  qtyOrdered: int.min(1),
  unitCost: num.min(0),
  taxPercent: num.min(0).max(100).default(0),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  orderDate: z.string().min(1, "Order date is required"),
  expectedDate: z.string().optional().or(z.literal("")),
  currency: z.string().length(3).default("USD"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lines: z.array(purchaseOrderLineSchema).min(1, "At least one line item required"),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;

export function computePOTotals(lines: PurchaseOrderLineInput[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const lineSubtotal = l.qtyOrdered * l.unitCost;
    subtotal += lineSubtotal;
    tax += lineSubtotal * (l.taxPercent / 100);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: round(subtotal), tax: round(tax), total: round(subtotal + tax) };
}
