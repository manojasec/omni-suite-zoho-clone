import "server-only";
import { publish, type RealtimeEvent } from "@/platform/realtime";

/**
 * Cliq realtime fan-out.
 *
 * Pure helpers (`cliqChannelKey`, `buildCliqMessageEvent`, `buildCliqTypingEvent`)
 * are unit-testable. `publishCliqMessage` / `publishCliqTyping` are thin
 * wrappers that call into the in-memory hub so SSE subscribers receive the
 * event in real time.
 *
 * Channel naming: `ws:<workspaceId>:cliq:<channelId>` — the same shape
 * already enforced by `/api/realtime/[channel]` membership gating.
 */

export type CliqMessageEventData = {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  createdAt: string; // ISO
};

export type CliqTypingEventData = {
  channelId: string;
  userId: string;
  /** Auto-expire hint, ms. UI should clear typing after this. */
  ttlMs: number;
};

export function cliqChannelKey(workspaceId: string, channelId: string): string {
  return `ws:${workspaceId}:cliq:${channelId}`;
}

export function buildCliqMessageEvent(input: {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  parentId?: string | null;
  createdAt: Date;
}): Omit<RealtimeEvent, "id"> {
  const data: CliqMessageEventData = {
    id: input.id,
    channelId: input.channelId,
    authorId: input.authorId,
    body: input.body,
    parentId: input.parentId ?? null,
    createdAt: input.createdAt.toISOString(),
  };
  return { type: "cliq.message.created", data };
}

export function buildCliqTypingEvent(input: {
  channelId: string;
  userId: string;
  ttlMs?: number;
}): Omit<RealtimeEvent, "id"> {
  const data: CliqTypingEventData = {
    channelId: input.channelId,
    userId: input.userId,
    ttlMs: input.ttlMs ?? 4000,
  };
  return { type: "cliq.typing", data };
}

export function publishCliqMessage(
  workspaceId: string,
  message: Parameters<typeof buildCliqMessageEvent>[0],
): void {
  publish(cliqChannelKey(workspaceId, message.channelId), buildCliqMessageEvent(message));
}

export function publishCliqTyping(
  workspaceId: string,
  typing: Parameters<typeof buildCliqTypingEvent>[0],
): void {
  publish(cliqChannelKey(workspaceId, typing.channelId), buildCliqTypingEvent(typing));
}
