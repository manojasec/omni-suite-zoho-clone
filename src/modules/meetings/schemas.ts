import { z } from "zod";

export const MEETING_KINDS = ["MEETING", "WEBINAR"] as const;
export const MEETING_STATUSES = [
  "SCHEDULED",
  "LIVE",
  "ENDED",
  "CANCELLED",
] as const;

export const MEETING_KIND_LABELS: Record<
  (typeof MEETING_KINDS)[number],
  string
> = {
  MEETING: "Meeting",
  WEBINAR: "Webinar",
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateJoinCode(): string {
  let out = "";
  for (let i = 0; i < 11; i++) {
    if (i === 3 || i === 7) {
      out += "-";
      continue;
    }
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export const meetingSchema = z.object({
  kind: z.enum(MEETING_KINDS).default("MEETING"),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().min(5).max(720).default(30),
  attendeeLimit: z.coerce.number().int().min(1).max(10000).default(100),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

export const attendeeSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .optional()
    .or(z.literal("")),
  role: z.enum(["HOST", "PRESENTER", "ATTENDEE"]).default("ATTENDEE"),
});

export const chatSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
