import { describe, it, expect } from "vitest";
import {
  channelSchema,
  messageSchema,
  normalizeChannelName,
  TEAM_CHANNEL_KINDS,
} from "@/modules/team-channels/schemas";

describe("team channels schemas", () => {
  it("accepts a valid channel", () => {
    expect(channelSchema.safeParse({ name: "design-team", kind: "PUBLIC" }).success).toBe(true);
    expect(channelSchema.safeParse({ name: "ops_42" }).success).toBe(true);
  });

  it("rejects channels with bad characters", () => {
    expect(channelSchema.safeParse({ name: "Design Team!" }).success).toBe(false);
    expect(channelSchema.safeParse({ name: "" }).success).toBe(false);
    expect(channelSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });

  it("normalizes channel names to safe slugs", () => {
    expect(normalizeChannelName("Design Team!")).toBe("design-team");
    expect(normalizeChannelName("  Foo   Bar ")).toBe("foo-bar");
    expect(normalizeChannelName("---weird---")).toBe("weird");
  });

  it("only allows PUBLIC and PRIVATE on creation (DIRECT is system-only)", () => {
    expect(channelSchema.safeParse({ name: "x", kind: "PUBLIC" }).success).toBe(true);
    expect(channelSchema.safeParse({ name: "x", kind: "PRIVATE" }).success).toBe(true);
    expect(channelSchema.safeParse({ name: "x", kind: "DIRECT" }).success).toBe(false);
  });

  it("coerces blank topic to undefined", () => {
    const r = channelSchema.safeParse({ name: "x", topic: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.topic).toBeUndefined();
  });

  it("rejects empty messages and trims whitespace", () => {
    expect(messageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    const r = messageSchema.safeParse({ body: "  hello world  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("hello world");
  });

  it("caps message body at 8000 characters", () => {
    expect(messageSchema.safeParse({ body: "a".repeat(8000) }).success).toBe(true);
    expect(messageSchema.safeParse({ body: "a".repeat(8001) }).success).toBe(false);
  });

  it("exposes the expected channel kinds", () => {
    expect(TEAM_CHANNEL_KINDS).toEqual(["PUBLIC", "PRIVATE", "DIRECT"]);
  });
});
