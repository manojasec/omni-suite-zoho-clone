import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const STOREFRONT_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type StorefrontStatus = (typeof STOREFRONT_STATUSES)[number];

export const STORE_ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "FULFILLED",
  "CANCELED",
  "REFUNDED",
] as const;
export type StoreOrderStatus = (typeof STORE_ORDER_STATUSES)[number];

export const STORE_ORDER_STATUS_LABELS: Record<StoreOrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FULFILLED: "Fulfilled",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
};

export const STOREFRONT_STATUS_LABELS: Record<StorefrontStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

const slugRe = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const storefrontSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .toLowerCase()
    .regex(slugRe, "Use only lowercase letters, numbers, and hyphens"),
  name: z.string().trim().min(1).max(160),
  headline: optionalString(240),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  supportEmail: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().email().max(160).optional(),
  ),
  status: z.enum(STOREFRONT_STATUSES).default("DRAFT"),
});

export const storeCustomerSchema = z.object({
  email: z.string().trim().email().max(160).toLowerCase(),
  name: z.string().trim().min(1).max(160),
  phone: optionalString(60),
  shippingAddress: optionalString(1000),
  notes: optionalString(1000),
});

export const createOrderSchema = z.object({
  customerId: z.string().trim().min(1),
  currency: z.string().trim().length(3).toUpperCase().default("USD"),
  notes: optionalString(2000),
});

export const addOrderItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(10_000),
});

export const updateOrderItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(10_000),
});

export type ItemAmounts = {
  unitPrice: number;
  taxPercent: number;
  quantity: number;
};

export type LineTotals = {
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNum(v: number | { toNumber(): number }): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return 0;
}

/**
 * Compute line totals from the snapshotted unit price / tax / quantity.
 * Negative or non-finite inputs produce zero.
 */
export function computeLineTotals(input: {
  unitPrice: number | { toNumber(): number };
  taxPercent: number | { toNumber(): number };
  quantity: number;
}): LineTotals {
  const price = toNum(input.unitPrice);
  const taxPct = toNum(input.taxPercent);
  const qty = Number(input.quantity);
  if (!Number.isFinite(price) || price < 0) {
    return { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
  }
  if (!Number.isFinite(taxPct) || taxPct < 0) {
    return { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return { lineSubtotal: 0, lineTax: 0, lineTotal: 0 };
  }
  const lineSubtotal = round2(price * qty);
  const lineTax = round2(lineSubtotal * (taxPct / 100));
  const lineTotal = round2(lineSubtotal + lineTax);
  return { lineSubtotal, lineTax, lineTotal };
}

export type OrderTotals = {
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
};

export function aggregateOrderTotals(
  items: {
    lineSubtotal: number | { toNumber(): number };
    lineTax: number | { toNumber(): number };
    lineTotal: number | { toNumber(): number };
    quantity: number;
  }[],
): OrderTotals {
  let subtotal = 0;
  let tax = 0;
  let total = 0;
  let itemCount = 0;
  for (const i of items) {
    const sub = toNum(i.lineSubtotal);
    const t = toNum(i.lineTax);
    const tot = toNum(i.lineTotal);
    if (Number.isFinite(sub)) subtotal += sub;
    if (Number.isFinite(t)) tax += t;
    if (Number.isFinite(tot)) total += tot;
    if (Number.isFinite(i.quantity) && i.quantity > 0) itemCount += i.quantity;
  }
  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    total: round2(total),
    itemCount,
  };
}

/** Allowed transitions for a store order. */
export const STORE_ORDER_TRANSITIONS: Record<
  StoreOrderStatus,
  readonly StoreOrderStatus[]
> = {
  PENDING: ["PAID", "CANCELED"],
  PAID: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export function canTransitionOrder(
  from: StoreOrderStatus,
  to: StoreOrderStatus,
): boolean {
  return STORE_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Format money amount as "USD 1,234.56". */
export function formatMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = safe.toFixed(2);
  const [whole, frac] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${grouped}.${frac}`;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString().slice(0, 10);
}

/** Slugify free-text into a storefront-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
