import { z } from "zod";

export const CHAT_STATUSES = ["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"] as const;
export const CHAT_SENDERS = ["VISITOR", "AGENT", "SYSTEM"] as const;

const opt = (s: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());

export const startChatSchema = z.object({
  visitorName: opt(z.string().min(1).max(80)),
  visitorEmail: opt(z.string().email().max(160)),
  pageUrl: opt(z.string().url().max(2048)),
  message: z.string().min(1).max(2000),
});

export const sendVisitorMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const sendAgentMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export const assignChatSchema = z.object({
  agentId: z.preprocess((v) => (v === "" || v === null ? null : v), z.string().nullable()),
});

export const updateChatStatusSchema = z.object({
  status: z.enum(CHAT_STATUSES),
});

export type ChatStatus = (typeof CHAT_STATUSES)[number];
export type ChatSender = (typeof CHAT_SENDERS)[number];

/** Allowed status transitions. Same-state is allowed (no-op). */
export function canChatTransition(from: ChatStatus, to: ChatStatus): boolean {
  if (from === to) return true;
  const matrix: Record<ChatStatus, ChatStatus[]> = {
    OPEN: ["ASSIGNED", "RESOLVED", "CLOSED"],
    ASSIGNED: ["OPEN", "RESOLVED", "CLOSED"],
    RESOLVED: ["CLOSED", "OPEN"],
    CLOSED: ["OPEN"],
  };
  return matrix[from].includes(to);
}
