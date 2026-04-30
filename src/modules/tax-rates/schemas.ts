import { z } from "zod";

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const taxRateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rate: z.coerce.number().min(0).max(100),
  region: optional(80),
  isInclusive: z.coerce.boolean().default(false),
  isDefault: z.coerce.boolean().default(false),
});
export type TaxRateInput = z.infer<typeof taxRateSchema>;

export function formatRate(rate: number): string {
  return `${rate.toFixed(2)}%`;
}

/** Apply tax to a base amount. Returns the tax portion only (rounded to 2dp). */
export function applyTax(input: {
  amount: number;
  rate: number;
  inclusive: boolean;
}): number {
  if (input.rate <= 0 || input.amount <= 0) return 0;
  const r = input.rate / 100;
  if (input.inclusive) {
    // amount already includes tax: tax = amount * r / (1 + r)
    return Math.round(((input.amount * r) / (1 + r)) * 100) / 100;
  }
  return Math.round(input.amount * r * 100) / 100;
}

/** Split a gross amount into net + tax using inclusive logic. */
export function splitInclusive(amount: number, rate: number) {
  const tax = applyTax({ amount, rate, inclusive: true });
  return { net: Math.round((amount - tax) * 100) / 100, tax };
}
