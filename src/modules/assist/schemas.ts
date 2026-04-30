import { z } from "zod";

export const ASSIST_SESSION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "ENDED",
  "CANCELLED",
] as const;

export const ASSIST_EVENT_KINDS = [
  "CREATED",
  "JOINED",
  "LEFT",
  "CHAT",
  "CONTROL_GRANTED",
  "CONTROL_RELEASED",
  "FILE_TRANSFER",
  "ENDED",
] as const;

export const ASSIST_EVENT_LABELS: Record<
  (typeof ASSIST_EVENT_KINDS)[number],
  string
> = {
  CREATED: "Session created",
  JOINED: "Customer joined",
  LEFT: "Customer left",
  CHAT: "Chat message",
  CONTROL_GRANTED: "Remote control granted",
  CONTROL_RELEASED: "Remote control released",
  FILE_TRANSFER: "File transfer",
  ENDED: "Session ended",
};

export const sessionSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z
    .string()
    .trim()
    .email()
    .max(190)
    .optional()
    .or(z.literal("")),
  customerPhone: z.string().trim().max(40).optional().or(z.literal("")),
  topic: z.string().trim().max(300).optional().or(z.literal("")),
});
export type SessionInput = z.infer<typeof sessionSchema>;

export const chatSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateAssistCode(): string {
  let out = "";
  for (let i = 0; i < 11; i++) {
    if (i === 3 || i === 7) {
      out += "-";
      continue;
    }
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out; // e.g. "ABCD-EFGH-JKL" → 3-3-3 letters with two dashes
}
