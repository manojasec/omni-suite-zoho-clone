import { describe, it, expect } from "vitest";
import {
  conversationSchema,
  messageSchema,
  generateAssistantReply,
} from "@/modules/ai/schemas";

describe("ai schemas", () => {
  it("conversationSchema requires a non-empty title", () => {
    expect(conversationSchema.parse({ title: "Plan" }).title).toBe("Plan");
    expect(() => conversationSchema.parse({ title: "" })).toThrow();
  });

  it("messageSchema enforces length bounds", () => {
    expect(messageSchema.parse({ content: "hi" }).content).toBe("hi");
    expect(() => messageSchema.parse({ content: "" })).toThrow();
    expect(() => messageSchema.parse({ content: "x".repeat(8001) })).toThrow();
  });

  it("generateAssistantReply branches on prompt shape", () => {
    expect(generateAssistantReply("summarize this report")).toContain("summary");
    expect(generateAssistantReply("how many tickets?").toLowerCase()).toContain("count");
    expect(generateAssistantReply("Why is the sky blue?")).toContain("Good question");
    expect(generateAssistantReply("Hello")).toContain("Acknowledged");
  });
});
