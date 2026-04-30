import { describe, it, expect } from "vitest";
import {
  ASSIST_EVENT_KINDS,
  ASSIST_EVENT_LABELS,
  chatSchema,
  generateAssistCode,
  sessionSchema,
} from "@/modules/assist/schemas";

describe("assist schemas", () => {
  it("accepts a valid session", () => {
    const out = sessionSchema.parse({
      customerName: " Jane Doe ",
      customerEmail: "jane@example.com",
      topic: "VPN issue",
    });
    expect(out.customerName).toBe("Jane Doe");
    expect(out.customerEmail).toBe("jane@example.com");
  });

  it("rejects empty customer name", () => {
    expect(() => sessionSchema.parse({ customerName: "  " })).toThrow();
  });

  it("rejects bad email", () => {
    expect(() =>
      sessionSchema.parse({
        customerName: "Jane",
        customerEmail: "not-an-email",
      }),
    ).toThrow();
  });

  it("allows blank email", () => {
    const out = sessionSchema.parse({
      customerName: "Jane",
      customerEmail: "",
    });
    expect(out.customerEmail).toBe("");
  });

  it("chatSchema rejects empty body", () => {
    expect(() => chatSchema.parse({ body: "  " })).toThrow();
  });

  it("chatSchema accepts a body", () => {
    expect(chatSchema.parse({ body: "Hello" }).body).toBe("Hello");
  });

  it("generateAssistCode produces XXX-XXX-XXX format", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateAssistCode();
      expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    }
  });

  it("has a label for every event kind", () => {
    for (const k of ASSIST_EVENT_KINDS) {
      expect(ASSIST_EVENT_LABELS[k]).toBeTruthy();
    }
  });
});
