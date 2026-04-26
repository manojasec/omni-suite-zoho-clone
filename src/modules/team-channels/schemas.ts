import { z } from "zod";

export const TEAM_CHANNEL_KINDS = ["PUBLIC", "PRIVATE", "DIRECT"] as const;
export const TEAM_CHANNEL_KIND_LABELS: Record<(typeof TEAM_CHANNEL_KINDS)[number], string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  DIRECT: "Direct",
};

const channelNameRule = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i, "Use letters, digits, ., -, _ only");

export const channelSchema = z.object({
  name: channelNameRule,
  topic: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
  kind: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(8000),
});

export type ChannelInput = z.infer<typeof channelSchema>;
export type MessageInput = z.infer<typeof messageSchema>;

export function normalizeChannelName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
