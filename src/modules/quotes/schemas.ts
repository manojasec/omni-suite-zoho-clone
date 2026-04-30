import { z } from "zod";

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CONVERTED",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  SENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  CONVERTED: "bg-purple-100 text-purple-800",
};

export function formatQuoteStatus(s: QuoteStatus | string): string {
  return STATUS_LABELS[s as QuoteStatus] ?? String(s);
}

export function quoteStatusColor(s: QuoteStatus): string {
  return STATUS_COLORS[s];
}

export const quoteLineSchema = z.object({
  description: z.string().trim().min(1, "Description required").max(500),
  qty: z.coerce.number().min(0).max(100_000),
  unitPrice: z.coerce.number().min(0).max(10_000_000),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
});
export type QuoteLineInput = z.infer<typeof quoteLineSchema>;

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const quoteHeaderSchema = z.object({
  customerId: z.string().min(1, "Customer required"),
  dealId: optional(40),
  currency: z.string().trim().min(3).max(8).default("USD"),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  notes: optional(2_000),
});
export type QuoteHeaderInput = z.infer<typeof quoteHeaderSchema>;

/** Round to 2 decimals to avoid floating point drift in totals. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type LineTotal = {
  amount: number;
  taxAmount: number;
};

/** Compute amount + per-line tax. */
export function computeLineTotal(line: {
  qty: number;
  unitPrice: number;
  taxPercent: number;
}): LineTotal {
  const subtotal = round2(line.qty * line.unitPrice);
  const taxAmount = round2(subtotal * (line.taxPercent / 100));
  return { amount: subtotal, taxAmount };
}

export type QuoteTotals = {
  subtotal: number;
  tax: number;
  total: number;
};

/** Sum subtotal/tax/total across all lines. */
export function computeQuoteTotals(
  lines: Array<{ qty: number; unitPrice: number; taxPercent: number }>,
): QuoteTotals {
  let subtotal = 0;
  let tax = 0;
  for (const ln of lines) {
    const t = computeLineTotal(ln);
    subtotal += t.amount;
    tax += t.taxAmount;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

/**
 * Allowed status transitions for a quote.
 * - DRAFT → SENT, REJECTED
 * - SENT → ACCEPTED, REJECTED, EXPIRED
 * - ACCEPTED → CONVERTED, REJECTED
 * - REJECTED, EXPIRED, CONVERTED are terminal
 */
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "REJECTED"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: ["CONVERTED", "REJECTED"],
  REJECTED: [],
  EXPIRED: [],
  CONVERTED: [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextQuoteNumber(existingNumbers: string[], prefix = "Q-"): string {
  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}(\\d+)$`);
  for (const n of existingNumbers) {
    const m = re.exec(n);
    if (m) {
      const v = Number.parseInt(m[1], 10);
      if (Number.isFinite(v) && v > max) max = v;
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
