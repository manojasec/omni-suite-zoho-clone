import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const PAY_ITEM_KINDS = ["EARNING", "DEDUCTION", "TAX"] as const;
export type PayItemKind = (typeof PAY_ITEM_KINDS)[number];

const isoDate = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === "string" && v.length > 0) return new Date(v);
  return v;
}, z.date());

export const payRunSchema = z
  .object({
    label: z.string().trim().min(1).max(160),
    periodStart: isoDate,
    periodEnd: isoDate,
    payDate: isoDate,
    currency: z.string().trim().length(3).toUpperCase().default("USD"),
    notes: optionalString(1000),
  })
  .superRefine((data, ctx) => {
    if (data.periodEnd < data.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "Period end must be on or after period start",
      });
    }
    if (data.payDate < data.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["payDate"],
        message: "Pay date cannot be before the period start",
      });
    }
  });
export type PayRunInput = z.infer<typeof payRunSchema>;

export const payItemSchema = z.object({
  kind: z.enum(PAY_ITEM_KINDS),
  label: z.string().trim().min(1).max(120),
  amount: z.coerce.number().finite().min(0).max(10_000_000),
});
export type PayItemInput = z.infer<typeof payItemSchema>;

export const addEmployeeToPayRunSchema = z.object({
  employeeId: z.string().trim().min(1),
  baseSalary: z.coerce.number().finite().min(0).max(10_000_000),
});

/**
 * Sum a list of pay items by kind. Non-finite or negative amounts are skipped.
 * Returns a totals object: { earnings, deductions, tax, gross, net }.
 *  - gross = sum of EARNING
 *  - net   = gross - deductions - tax (clamped at 0)
 */
export function summarizePaySlip(
  items: ReadonlyArray<{ kind: PayItemKind; amount: number | { toNumber: () => number } }>,
): { earnings: number; deductions: number; tax: number; gross: number; net: number } {
  let earnings = 0;
  let deductions = 0;
  let tax = 0;
  for (const it of items) {
    const raw = typeof it.amount === "number" ? it.amount : it.amount.toNumber();
    if (!Number.isFinite(raw) || raw < 0) continue;
    if (it.kind === "EARNING") earnings += raw;
    else if (it.kind === "DEDUCTION") deductions += raw;
    else if (it.kind === "TAX") tax += raw;
  }
  const gross = round2(earnings);
  const dd = round2(deductions);
  const tt = round2(tax);
  const net = Math.max(0, round2(gross - dd - tt));
  return { earnings: gross, deductions: dd, tax: tt, gross, net };
}

/** Aggregate totals across multiple slips. */
export function aggregateRunTotals(
  slips: ReadonlyArray<{
    gross: number | { toNumber: () => number };
    deductions: number | { toNumber: () => number };
    tax: number | { toNumber: () => number };
    net: number | { toNumber: () => number };
  }>,
): { totalGross: number; totalDeductions: number; totalTax: number; totalNet: number } {
  let g = 0;
  let d = 0;
  let t = 0;
  let n = 0;
  for (const s of slips) {
    g += toNum(s.gross);
    d += toNum(s.deductions);
    t += toNum(s.tax);
    n += toNum(s.net);
  }
  return {
    totalGross: round2(g),
    totalDeductions: round2(d),
    totalTax: round2(t),
    totalNet: round2(n),
  };
}

function toNum(v: number | { toNumber: () => number }): number {
  const n = typeof v === "number" ? v : v.toNumber();
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build default earnings/tax/deduction items from a base salary. Tax is 20% flat. */
export function defaultItemsFromSalary(
  baseSalary: number,
): Array<{ kind: PayItemKind; label: string; amount: number }> {
  if (!Number.isFinite(baseSalary) || baseSalary <= 0) return [];
  const earnings = round2(baseSalary);
  const tax = round2(earnings * 0.2);
  return [
    { kind: "EARNING", label: "Base salary", amount: earnings },
    { kind: "TAX", label: "Income tax (20%)", amount: tax },
  ];
}

/** Format amount with currency code, e.g. "USD 1,250.00". */
export function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) amount = 0;
  const fixed = amount.toFixed(2);
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${grouped}.${frac}`;
}

/** Format a Date as YYYY-MM-DD. */
export function formatDate(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export const PAY_RUN_STATUS_LABELS = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELED: "Canceled",
} as const;

export const PAY_ITEM_KIND_LABELS = {
  EARNING: "Earning",
  DEDUCTION: "Deduction",
  TAX: "Tax",
} as const;
