import { z } from "zod";

export const SHARED_THREAD_STATUSES = ["OPEN", "PENDING", "CLOSED"] as const;
export const SHARED_THREAD_STATUS_LABELS: Record<
  (typeof SHARED_THREAD_STATUSES)[number],
  string
> = {
  OPEN: "Open",
  PENDING: "Pending",
  CLOSED: "Closed",
};

export const inboxSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().email().max(190),
});
export type InboxInput = z.infer<typeof inboxSchema>;

export const threadSchema = z.object({
  inboxId: z.string().trim().min(1),
  fromName: z.string().trim().min(1).max(160),
  fromEmail: z.string().trim().email().max(190),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});
export type ThreadInput = z.infer<typeof threadSchema>;

export const replySchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  direction: z.enum(["OUT", "NOTE"]).default("OUT"),
});
