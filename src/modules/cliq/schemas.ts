import { z } from "zod";

export const CHANNEL_KINDS = ["PUBLIC", "PRIVATE", "DM"] as const;
export const CHANNEL_KIND_LABELS: Record<
  (typeof CHANNEL_KINDS)[number],
  string
> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  DM: "Direct message",
};

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  topic: z.string().trim().max(300).optional().or(z.literal("")),
  kind: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});
export type ChannelInput = z.infer<typeof channelSchema>;

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().trim().min(1).max(40).optional().or(z.literal("")),
});
