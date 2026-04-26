import { z } from "zod";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const courseSchema = z.object({
  slug: z.string().trim().min(1).max(80).regex(slugRegex, "Slug must be lowercase letters, digits, dashes"),
  title: z.string().trim().min(1).max(160),
  summary: optionalString(500),
  description: optionalString(20_000),
  coverImageUrl: optionalString(500),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const lessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: optionalString(50_000),
  durationMinutes: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const enrollSchema = z.object({
  learnerEmail: z.string().trim().toLowerCase().email().max(200),
  learnerName: z.string().trim().min(1).max(160),
});
export type EnrollInput = z.infer<typeof enrollSchema>;

export const reorderSchema = z.object({
  direction: z.enum(["up", "down"]),
});

/** Slugify a candidate course title to a valid slug, capped at 80 chars. */
export function slugifyCourse(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 80);
}

/**
 * Compute completion percentage for an enrollment given the number of
 * lessons completed and total lessons. Returns 0..100 (integer).
 */
export function progressPercent(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  const pct = (completed / total) * 100;
  if (pct <= 0) return 0;
  if (pct >= 100) return 100;
  return Math.round(pct);
}

/** True iff every lesson has a progress row for this enrollment. */
export function isFullyComplete(completed: number, total: number): boolean {
  return total > 0 && completed >= total;
}

/** Total course duration in minutes from a list of lessons. */
export function totalDurationMinutes(lessons: ReadonlyArray<{ durationMinutes: number }>): number {
  let sum = 0;
  for (const l of lessons) {
    if (Number.isFinite(l.durationMinutes) && l.durationMinutes > 0) sum += l.durationMinutes;
  }
  return sum;
}

/** Format minutes as "1h 15m" / "45m" / "0m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const m = Math.floor(minutes);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem}m`;
  if (rem <= 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

export const COURSE_STATUS_LABELS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
} as const;

export const ENROLLMENT_STATUS_LABELS = {
  ENROLLED: "Enrolled",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
} as const;
