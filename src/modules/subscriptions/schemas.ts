import { z } from "zod";

export const BILLING_INTERVALS = ["WEEK", "MONTH", "QUARTER", "YEAR"] as const;
export const SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "PAUSED", "CANCELED", "EXPIRED"] as const;
export const SUBSCRIPTION_INVOICE_STATUSES = ["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const subscriptionPlanSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(60)
    .regex(/^[a-z0-9_-]+$/i, "Lowercase letters, digits, hyphen and underscore only")
    .transform((v) => v.toLowerCase()),
  description: optionalText(8000),
  amount: z.coerce.number().nonnegative().max(99_999_999),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "ISO 4217 code").default("USD"),
  interval: z.enum(BILLING_INTERVALS).default("MONTH"),
  intervalCount: z.coerce.number().int().min(1).max(12).default(1),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  active: z.coerce.boolean().default(true),
});
export type SubscriptionPlanInput = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionSchema = z
  .object({
    planId: z.string().trim().min(1, "Plan required"),
    customerName: z.string().trim().min(1).max(160),
    customerEmail: z.string().trim().toLowerCase().email().max(160),
    quantity: z.coerce.number().int().min(1).max(9999).default(1),
    startedAt: z.coerce.date(),
    notes: optionalText(4000),
  });
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const subscriptionUpdateSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().toLowerCase().email().max(160),
  quantity: z.coerce.number().int().min(1).max(9999),
  notes: optionalText(4000),
});

/** Add `count` intervals to a date. Pure utility — no clamping. */
export function addInterval(date: Date, interval: (typeof BILLING_INTERVALS)[number], count: number): Date {
  const d = new Date(date.getTime());
  switch (interval) {
    case "WEEK":
      d.setUTCDate(d.getUTCDate() + 7 * count);
      return d;
    case "MONTH":
      d.setUTCMonth(d.getUTCMonth() + count);
      return d;
    case "QUARTER":
      d.setUTCMonth(d.getUTCMonth() + 3 * count);
      return d;
    case "YEAR":
      d.setUTCFullYear(d.getUTCFullYear() + count);
      return d;
  }
}

/** Compute trial end and the first billing period from a plan + start date. */
export function computeInitialPeriod(opts: {
  startedAt: Date;
  trialDays: number;
  interval: (typeof BILLING_INTERVALS)[number];
  intervalCount: number;
}): { trialEndsAt: Date | null; currentPeriodStart: Date; currentPeriodEnd: Date; status: "TRIALING" | "ACTIVE" } {
  const trialing = opts.trialDays > 0;
  const trialEndsAt = trialing
    ? new Date(opts.startedAt.getTime() + opts.trialDays * 24 * 60 * 60 * 1000)
    : null;
  const periodStart = trialing ? trialEndsAt! : opts.startedAt;
  const periodEnd = addInterval(periodStart, opts.interval, opts.intervalCount);
  return {
    trialEndsAt,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    status: trialing ? "TRIALING" : "ACTIVE",
  };
}

/** Compute MRR (monthly recurring revenue) contribution for one subscription. */
export function mrrFor(opts: {
  amount: number;
  interval: (typeof BILLING_INTERVALS)[number];
  intervalCount: number;
  quantity: number;
}): number {
  const totalPerPeriod = opts.amount * opts.quantity;
  const monthsPerPeriod =
    opts.interval === "WEEK"
      ? (7 * opts.intervalCount) / 30
      : opts.interval === "MONTH"
        ? opts.intervalCount
        : opts.interval === "QUARTER"
          ? 3 * opts.intervalCount
          : 12 * opts.intervalCount;
  if (monthsPerPeriod <= 0) return 0;
  return totalPerPeriod / monthsPerPeriod;
}

/** Subscription is in a "live" state (counts toward MRR). */
export function isLiveSubscriptionStatus(status: (typeof SUBSCRIPTION_STATUSES)[number]): boolean {
  return status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE";
}

/** Whether a status transition is allowed. */
export function isValidSubscriptionTransition(
  from: (typeof SUBSCRIPTION_STATUSES)[number],
  to: (typeof SUBSCRIPTION_STATUSES)[number],
): boolean {
  if (from === to) return true;
  if (from === "EXPIRED") return false;
  if (from === "CANCELED") return false;
  return true;
}

/** Generate a sortable invoice number like INV-2026-000123 from a sequence. */
export function formatInvoiceNumber(year: number, seq: number): string {
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}
