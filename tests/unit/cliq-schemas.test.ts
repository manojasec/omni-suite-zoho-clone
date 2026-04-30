import { describe, it, expect } from "vitest";
import { channelSchema, messageSchema } from "@/modules/cliq/schemas";

describe("cliq schemas", () => {
  it("channelSchema accepts lowercase hyphenated name", () => {
    const c = channelSchema.parse({ name: "general-team", kind: "PUBLIC" });
    expect(c.name).toBe("general-team");
  });

  it("channelSchema rejects uppercase or spaces", () => {
    expect(() => channelSchema.parse({ name: "General" })).toThrow();
    expect(() => channelSchema.parse({ name: "team chat" })).toThrow();
  });

  it("messageSchema rejects empty bodies and oversized ones", () => {
    expect(() => messageSchema.parse({ body: "" })).toThrow();
    expect(() => messageSchema.parse({ body: "x".repeat(5000) })).toThrow();
  });

  it("messageSchema accepts a parentId for threads", () => {
    const m = messageSchema.parse({ body: "reply", parentId: "abc123" });
    expect(m.parentId).toBe("abc123");
  });
});
