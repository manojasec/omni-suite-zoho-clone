import { createHmac, timingSafeEqual } from "node:crypto";
import { DEFAULT_POINTS, type LeadScoreEventType } from "@/modules/scoring/schemas";

/**
 * Lead-scoring webhook — pure verifiers + payload mappers.
 *
 * External systems (ad platforms, marketing automation, telephony) POST
 * activity events into `/api/scoring/webhook/[workspaceId]`. The handler
 * delegates to this module to:
 *   1. verify the HMAC-SHA256 signature timing-safely;
 *   2. parse the payload into one or more `WebhookEvent` records;
 *   3. score each event using the workspace's active rule set (lookups happen
 *      at the caller).
 */

export interface WebhookEvent {
  contactEmail: string;
  eventType: LeadScoreEventType;
  reason?: string;
  /** Override points; otherwise derive from active rule or DEFAULT_POINTS. */
  points?: number;
  occurredAt?: Date;
}

/**
 * Verify an HMAC-SHA256 signature delivered in the `X-Signature` header.
 * Convention: `sha256=<hex>` (matches the common Stripe / GitHub format).
 */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const cleaned = header.startsWith("sha256=") ? header.slice("sha256=".length) : header;
  if (!/^[0-9a-f]+$/i.test(cleaned)) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(cleaned.toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parse a JSON webhook body. Accepts both:
 *   - a single event:   { email, type, reason?, points? }
 *   - a batch:          { events: [ ... ] }
 *
 * Throws when required fields are missing/malformed.
 */
export function parseWebhookPayload(json: unknown): WebhookEvent[] {
  if (!json || typeof json !== "object") throw new Error("Payload must be an object");
  const obj = json as Record<string, unknown>;
  const raw = Array.isArray(obj.events) ? obj.events : [obj];
  return raw.map((entry, i) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`events[${i}] is not an object`);
    }
    const e = entry as Record<string, unknown>;
    const email = stringOf(e.email);
    const type = stringOf(e.type);
    if (!email) throw new Error(`events[${i}].email is required`);
    if (!type) throw new Error(`events[${i}].type is required`);
    if (!(type in DEFAULT_POINTS)) throw new Error(`events[${i}].type "${type}" is not a known LeadScoreEventType`);
    const ev: WebhookEvent = { contactEmail: email, eventType: type as LeadScoreEventType };
    if (typeof e.reason === "string") ev.reason = e.reason.slice(0, 300);
    if (typeof e.points === "number" && Number.isFinite(e.points)) ev.points = Math.trunc(e.points);
    if (typeof e.occurredAt === "string") {
      const d = new Date(e.occurredAt);
      if (!isNaN(d.getTime())) ev.occurredAt = d;
    }
    return ev;
  });
}

function stringOf(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Resolve final point value for an event given the workspace's active rules.
 * Order: explicit `event.points` → matching active rule → DEFAULT_POINTS.
 */
export function resolvePoints(
  event: WebhookEvent,
  activeRules: { eventType: LeadScoreEventType; points: number; active: boolean }[],
): number {
  if (typeof event.points === "number") return event.points;
  const rule = activeRules.find((r) => r.active && r.eventType === event.eventType);
  if (rule) return rule.points;
  return DEFAULT_POINTS[event.eventType];
}
