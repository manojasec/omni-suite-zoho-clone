import { z } from "zod";

export const conversationSchema = z.object({
  title: z.string().min(1).max(200),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(8000),
});

export type ConversationInput = z.infer<typeof conversationSchema>;
export type MessageInput = z.infer<typeof messageSchema>;

/**
 * Generate a deterministic stub assistant reply. In production this would call
 * an LLM gateway with tool/function-calling for workspace context.
 */
export function generateAssistantReply(userContent: string): string {
  const trimmed = userContent.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("summarize") || lower.startsWith("summary")) {
    return `Here is a brief summary based on your prompt: "${trimmed.slice(0, 160)}". (stub)`;
  }
  if (lower.includes("how many") || lower.includes("count")) {
    return "I can help count records once connected to a model. For now, try the relevant module's list view. (stub)";
  }
  if (lower.endsWith("?")) {
    return `Good question. A real assistant would search workspace data for: "${trimmed.slice(0, 160)}". (stub)`;
  }
  return `Acknowledged. You said: "${trimmed.slice(0, 200)}". (stub)`;
}
