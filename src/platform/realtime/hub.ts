import "server-only";

/**
 * In-memory pub/sub hub for SSE fanout.
 *
 * Scope: single Node process. For multi-instance deployments, swap the
 * underlying `subscribers` Map with a Redis pub/sub or PG LISTEN/NOTIFY
 * adapter — the public API stays the same.
 *
 * Channel naming convention: `<workspaceId>:<resource>:<id?>`
 *   e.g. "ws_123:notifications", "ws_123:cliq:channel_456",
 *        "ws_123:helpdesk:ticket_789".
 *
 * Public channels (workspaceId-less): "public:chat:visitor_abc".
 */

export type RealtimeEvent = {
  /** Event type tag, e.g. "message.created" */
  type: string;
  /** Free-form JSON-serialisable payload. */
  data: unknown;
  /** Server-assigned monotonically-increasing id (string for SSE compat). */
  id?: string;
  /** Optional retry hint in ms for the EventSource client. */
  retry?: number;
};

type Subscriber = (event: RealtimeEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();
let counter = 0;

export function subscribe(channel: string, handler: Subscriber): () => void {
  let set = subscribers.get(channel);
  if (!set) {
    set = new Set();
    subscribers.set(channel, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
    if (set!.size === 0) subscribers.delete(channel);
  };
}

export function publish(channel: string, event: Omit<RealtimeEvent, "id"> & { id?: string }): void {
  const set = subscribers.get(channel);
  if (!set || set.size === 0) return;
  const id = event.id ?? `${Date.now()}-${++counter}`;
  const enriched: RealtimeEvent = { ...event, id };
  for (const fn of set) {
    try {
      fn(enriched);
    } catch {
      // never let one bad subscriber break the fanout
    }
  }
}

export function subscriberCount(channel: string): number {
  return subscribers.get(channel)?.size ?? 0;
}

export function channelCount(): number {
  return subscribers.size;
}

/** Encode an event in SSE wire format. */
export function encodeSse(event: RealtimeEvent): string {
  const lines: string[] = [];
  if (event.id) lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.type}`);
  if (event.retry) lines.push(`retry: ${event.retry}`);
  const payload = JSON.stringify(event.data ?? null);
  for (const dataLine of payload.split("\n")) lines.push(`data: ${dataLine}`);
  return lines.join("\n") + "\n\n";
}
