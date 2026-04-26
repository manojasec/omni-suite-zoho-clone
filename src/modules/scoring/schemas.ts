import { z } from "zod";

export const LEAD_SCORE_EVENT_TYPES = [
  "EMAIL_OPENED",
  "EMAIL_CLICKED",
  "FORM_SUBMITTED",
  "MEETING_HELD",
  "PAGE_VISIT",
  "MANUAL",
] as const;

export type LeadScoreEventType = (typeof LEAD_SCORE_EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<LeadScoreEventType, string> = {
  EMAIL_OPENED: "Email opened",
  EMAIL_CLICKED: "Email link clicked",
  FORM_SUBMITTED: "Form submitted",
  MEETING_HELD: "Meeting held",
  PAGE_VISIT: "Page visited",
  MANUAL: "Manual adjustment",
};

/** Default suggested points by event type (workspaces can override per rule). */
export const DEFAULT_POINTS: Record<LeadScoreEventType, number> = {
  EMAIL_OPENED: 1,
  EMAIL_CLICKED: 5,
  FORM_SUBMITTED: 10,
  MEETING_HELD: 20,
  PAGE_VISIT: 1,
  MANUAL: 0,
};

export const ruleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  eventType: z.enum(LEAD_SCORE_EVENT_TYPES),
  points: z.coerce.number().int().min(-1000).max(1000),
  active: z.coerce.boolean().optional().default(true),
});
export type RuleInput = z.infer<typeof ruleSchema>;

export const manualEventSchema = z.object({
  contactId: z.string().min(1),
  points: z.coerce.number().int().min(-1000).max(1000).refine((n) => n !== 0, {
    message: "Points must be non-zero",
  }),
  reason: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
});
export type ManualEventInput = z.infer<typeof manualEventSchema>;

/** Bucket a numeric score into a temperature label. */
export function scoreBucket(score: number): "cold" | "warm" | "hot" {
  if (score >= 50) return "hot";
  if (score >= 20) return "warm";
  return "cold";
}

/** Tailwind class hint for score bucket. */
export function scoreBucketClass(score: number): string {
  const b = scoreBucket(score);
  if (b === "hot") return "bg-rose-100 text-rose-700";
  if (b === "warm") return "bg-amber-100 text-amber-700";
  return "bg-zinc-100 text-zinc-600";
}

/**
 * Sum points from an array of recorded events. Pure helper used by tests
 * and views that compute on the fly without aggregation queries.
 */
export function sumPoints(events: Array<{ points: number }>): number {
  return events.reduce((s, e) => s + (Number.isFinite(e.points) ? e.points : 0), 0);
}
