import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  parseWebhookPayload,
  resolvePoints,
  verifySignature,
  type WebhookEvent,
} from "@/modules/scoring/webhook";

const SECRET = "topsecret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("scoring webhook — verifySignature", () => {
  it("accepts a correct HMAC header", () => {
    const body = JSON.stringify({ email: "a@b.com", type: "EMAIL_OPENED" });
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ email: "a@b.com", type: "EMAIL_OPENED" });
    expect(verifySignature(body + " ", sign(body), SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const body = "{}";
    expect(verifySignature(body, sign(body), "other-secret")).toBe(false);
  });

  it("rejects malformed header", () => {
    expect(verifySignature("{}", "not-hex!!", SECRET)).toBe(false);
    expect(verifySignature("{}", null, SECRET)).toBe(false);
  });
});

describe("scoring webhook — parseWebhookPayload", () => {
  it("parses a single event", () => {
    const evs = parseWebhookPayload({ email: "a@b.com", type: "EMAIL_OPENED" });
    expect(evs).toHaveLength(1);
    expect(evs[0]?.contactEmail).toBe("a@b.com");
    expect(evs[0]?.eventType).toBe("EMAIL_OPENED");
  });

  it("parses a batch with optional reason/points/occurredAt", () => {
    const evs = parseWebhookPayload({
      events: [
        { email: "a@b.com", type: "EMAIL_CLICKED", reason: "newsletter", points: 7 },
        { email: "c@d.com", type: "FORM_SUBMITTED", occurredAt: "2026-05-01T10:00:00Z" },
      ],
    });
    expect(evs).toHaveLength(2);
    expect(evs[0]?.points).toBe(7);
    expect(evs[1]?.occurredAt?.toISOString()).toBe("2026-05-01T10:00:00.000Z");
  });

  it("throws on unknown event type", () => {
    expect(() => parseWebhookPayload({ email: "a@b.com", type: "WAT" })).toThrow(/LeadScoreEventType/);
  });

  it("throws when email missing", () => {
    expect(() => parseWebhookPayload({ type: "EMAIL_OPENED" })).toThrow(/email/);
  });

  it("throws on non-object payload", () => {
    expect(() => parseWebhookPayload(null)).toThrow();
    expect(() => parseWebhookPayload("nope")).toThrow();
  });
});

describe("scoring webhook — resolvePoints", () => {
  const baseEvent: WebhookEvent = { contactEmail: "a@b.com", eventType: "EMAIL_CLICKED" };

  it("explicit event.points wins", () => {
    expect(resolvePoints({ ...baseEvent, points: 42 }, [])).toBe(42);
  });

  it("active rule applies next", () => {
    expect(
      resolvePoints(baseEvent, [
        { eventType: "EMAIL_CLICKED", points: 9, active: true },
      ]),
    ).toBe(9);
  });

  it("inactive rule falls through to DEFAULT_POINTS", () => {
    expect(
      resolvePoints(baseEvent, [
        { eventType: "EMAIL_CLICKED", points: 9, active: false },
      ]),
    ).toBe(5); // DEFAULT_POINTS.EMAIL_CLICKED = 5
  });

  it("no matching rule → DEFAULT_POINTS", () => {
    expect(resolvePoints({ contactEmail: "a@b.com", eventType: "FORM_SUBMITTED" }, [])).toBe(10);
  });
});
