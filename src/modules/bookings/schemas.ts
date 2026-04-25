import { z } from "zod";

const trimmedOptional = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim() || undefined);

export const slugRegex = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

export const bookingTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  publicSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(slugRegex, "Slug may only contain lowercase letters, numbers, and hyphens"),
  description: trimmedOptional,
  durationMins: z.coerce
    .number()
    .int("Duration must be a whole number")
    .min(5, "Duration must be at least 5 minutes")
    .max(8 * 60, "Duration must be at most 8 hours"),
  bufferMins: z.coerce
    .number()
    .int()
    .min(0)
    .max(120)
    .default(0),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/u, "Color must be a hex value like #0F172A")
    .default("#0F172A"),
});
export type BookingTypeInput = z.infer<typeof bookingTypeSchema>;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/u;

export const availabilityRowSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    enabled: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === "on" || v === "true"),
    start: z.string().regex(timeRegex, "Use HH:MM").default("09:00"),
    end: z.string().regex(timeRegex, "Use HH:MM").default("17:00"),
  })
  .refine(
    (v) => !v.enabled || toMinutes(v.end) > toMinutes(v.start),
    { message: "End time must be after start time", path: ["end"] },
  );
export type AvailabilityRowInput = z.infer<typeof availabilityRowSchema>;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export const publicBookingSchema = z.object({
  attendeeName: z.string().trim().min(1, "Your name is required").max(120),
  attendeeEmail: z.string().trim().email("A valid email is required"),
  attendeePhone: trimmedOptional,
  notes: trimmedOptional,
  startsAt: z
    .string()
    .trim()
    .min(1, "Pick a time slot")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid start time"),
});
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: trimmedOptional,
});
