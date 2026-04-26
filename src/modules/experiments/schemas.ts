import { z } from "zod";
import { createHash } from "crypto";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const variantKeyRegex = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const variantSchema = z.object({
  key: z.string().trim().regex(variantKeyRegex, "lowercase letters/numbers/_-").max(40),
  label: z.string().trim().min(1).max(120),
  weight: z.coerce.number().int().min(1).max(100),
  isControl: z.coerce.boolean().optional().default(false),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const variantsSchema = z
  .array(variantSchema)
  .min(2, "At least two variants required")
  .max(6, "Up to six variants allowed")
  .superRefine((variants, ctx) => {
    const keys = new Set<string>();
    for (const v of variants) {
      if (keys.has(v.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate key: ${v.key}` });
      }
      keys.add(v.key);
    }
    const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
    if (totalWeight !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Weights must sum to 100 (got ${totalWeight})`,
      });
    }
    const controls = variants.filter((v) => v.isControl).length;
    if (controls !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one variant must be marked as control",
      });
    }
  });

export const experimentSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(slugRegex, "Use lowercase letters, numbers, and dashes."),
  name: z.string().trim().min(1).max(160),
  hypothesis: optionalString(1000),
  primaryMetric: optionalString(120),
});
export type ExperimentInput = z.infer<typeof experimentSchema>;

export const trackEventSchema = z.object({
  visitorId: z.string().trim().min(8).max(64),
  variantKey: z.string().trim().regex(variantKeyRegex).max(40),
  kind: z.enum(["VIEW", "CONVERSION"]),
  value: z.coerce.number().min(0).max(1_000_000).optional(),
});
export type TrackEventInput = z.infer<typeof trackEventSchema>;

export const assignSchema = z.object({
  visitorId: z.string().trim().min(8).max(64),
});
export type AssignInput = z.infer<typeof assignSchema>;

/** Lowercase + replace invalid chars with dashes; trims dashes; max 80 chars. */
export function slugifyExperiment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Deterministically pick a variant for a visitor using a stable hash so that
 * the same visitor always gets the same bucket within an experiment.
 */
export function assignVariant(
  experimentId: string,
  visitorId: string,
  variants: ReadonlyArray<{ key: string; weight: number }>,
): string {
  const total = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (total <= 0) throw new Error("No allocation weight on variants");
  // Stable bucket in [0, total).
  const hex = createHash("sha256")
    .update(`${experimentId}:${visitorId}`)
    .digest("hex")
    .slice(0, 12); // 48 bits is plenty for bucketing
  const num = Number.parseInt(hex, 16);
  const bucket = num % total;
  let acc = 0;
  for (const v of variants) {
    acc += Math.max(0, v.weight);
    if (bucket < acc) return v.key;
  }
  // Fallback (shouldn't reach here unless rounding glitch).
  return variants[variants.length - 1]!.key;
}

/** Conversion rate as a 0..1 fraction; 0 when no views. */
export function conversionRate(views: number, conversions: number): number {
  if (!Number.isFinite(views) || views <= 0) return 0;
  return Math.max(0, Math.min(1, conversions / views));
}

/** Format a 0..1 fraction as "12.3%" (1 decimal). */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return "0.0%";
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Compute a per-variant summary from raw event tuples. Pure helper used by
 * tests and the detail page.
 */
export function summarizeEvents(
  events: ReadonlyArray<{ variantKey: string; kind: "VIEW" | "CONVERSION" }>,
): Record<string, { views: number; conversions: number; rate: number }> {
  const out: Record<string, { views: number; conversions: number; rate: number }> = {};
  for (const e of events) {
    const k = e.variantKey;
    if (!out[k]) out[k] = { views: 0, conversions: 0, rate: 0 };
    if (e.kind === "VIEW") out[k].views += 1;
    else out[k].conversions += 1;
  }
  for (const v of Object.values(out)) v.rate = conversionRate(v.views, v.conversions);
  return out;
}
