import { describe, expect, it } from "vitest";
import {
  assignChatSchema,
  canChatTransition,
  sendVisitorMessageSchema,
  startChatSchema,
  updateChatStatusSchema,
} from "@/modules/chat/schemas";

describe("startChatSchema", () => {
  it("accepts minimal payload", () => {
    expect(startChatSchema.safeParse({ message: "Hi" }).success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(startChatSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("rejects oversized message", () => {
    expect(startChatSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });

  it("treats blank optional fields as undefined", () => {
    const r = startChatSchema.safeParse({
      visitorName: "",
      visitorEmail: "",
      pageUrl: "",
      message: "Hello",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.visitorName).toBeUndefined();
      expect(r.data.visitorEmail).toBeUndefined();
      expect(r.data.pageUrl).toBeUndefined();
    }
  });

  it("validates email format when present", () => {
    expect(
      startChatSchema.safeParse({ visitorEmail: "not-an-email", message: "hi" }).success,
    ).toBe(false);
  });
});

describe("sendVisitorMessageSchema", () => {
  it("requires non-empty body", () => {
    expect(sendVisitorMessageSchema.safeParse({ body: "" }).success).toBe(false);
    expect(sendVisitorMessageSchema.safeParse({ body: "ok" }).success).toBe(true);
  });
});

describe("assignChatSchema", () => {
  it("converts empty string to null", () => {
    const r = assignChatSchema.safeParse({ agentId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.agentId).toBeNull();
  });

  it("preserves a valid id", () => {
    const r = assignChatSchema.safeParse({ agentId: "user_123" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.agentId).toBe("user_123");
  });
});

describe("updateChatStatusSchema", () => {
  it("accepts known statuses", () => {
    expect(updateChatStatusSchema.safeParse({ status: "ASSIGNED" }).success).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(updateChatStatusSchema.safeParse({ status: "MAYBE" }).success).toBe(false);
  });
});

describe("canChatTransition", () => {
  it("allows reasonable transitions", () => {
    expect(canChatTransition("OPEN", "ASSIGNED")).toBe(true);
    expect(canChatTransition("ASSIGNED", "RESOLVED")).toBe(true);
    expect(canChatTransition("RESOLVED", "CLOSED")).toBe(true);
    expect(canChatTransition("CLOSED", "OPEN")).toBe(true);
    expect(canChatTransition("RESOLVED", "OPEN")).toBe(true);
  });

  it("blocks impossible transitions", () => {
    expect(canChatTransition("CLOSED", "ASSIGNED")).toBe(false);
    expect(canChatTransition("CLOSED", "RESOLVED")).toBe(false);
    expect(canChatTransition("OPEN", "RESOLVED")).toBe(true);
  });

  it("treats same-state as allowed", () => {
    expect(canChatTransition("OPEN", "OPEN")).toBe(true);
    expect(canChatTransition("CLOSED", "CLOSED")).toBe(true);
  });
});
