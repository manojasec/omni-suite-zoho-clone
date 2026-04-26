import { z } from "zod";

export const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"] as const;
export const EVENT_REGISTRATION_STATUSES = [
  "REGISTERED",
  "CONFIRMED",
  "ATTENDED",
  "CANCELLED",
  "WAITLISTED",
] as const;

export const EVENT_STATUS_LABELS: Record<(typeof EVENT_STATUSES)[number], string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const REGISTRATION_STATUS_LABELS: Record<
  (typeof EVENT_REGISTRATION_STATUSES)[number],
  string
> = {
  REGISTERED: "Registered",
  CONFIRMED: "Confirmed",
  ATTENDED: "Attended",
  CANCELLED: "Cancelled",
  WAITLISTED: "Waitlisted",
};

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : typeof v === "string" ? Number(v) : v),
  z.number().int().min(1).max(1_000_000).optional(),
);

const dateInput = z.preprocess(
  (v) => {
    if (v instanceof Date) return v;
    if (typeof v === "string" && v.trim().length > 0) return new Date(v);
    return undefined;
  },
  z.date(),
);

export const eventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i, "Slug must be alphanumeric (dashes allowed)"),
    summary: optionalString(500),
    description: optionalString(10_000),
    location: optionalString(300),
    isVirtual: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    meetingUrl: optionalString(500),
    status: z.enum(EVENT_STATUSES).default("DRAFT"),
    startsAt: dateInput,
    endsAt: dateInput,
    capacity: optionalInt,
    coverImageUrl: optionalString(500),
  })
  .refine((v) => v.endsAt.getTime() > v.startsAt.getTime(), {
    message: "End time must be after start time",
    path: ["endsAt"],
  });

export const eventSessionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    speaker: optionalString(160),
    location: optionalString(200),
    startsAt: dateInput,
    endsAt: dateInput,
    notes: optionalString(1000),
  })
  .refine((v) => v.endsAt.getTime() > v.startsAt.getTime(), {
    message: "End time must be after start time",
    path: ["endsAt"],
  });

export const registrationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(200),
  phone: optionalString(40),
  company: optionalString(200),
  notes: optionalString(500),
});

export type EventInput = z.infer<typeof eventSchema>;
export type EventSessionInput = z.infer<typeof eventSessionSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;

const TICKET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTicketCode(): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += TICKET_ALPHABET[bytes[i] % TICKET_ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
