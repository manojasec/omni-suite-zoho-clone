import { describe, it, expect } from "vitest";
import {
  inboxSchema,
  threadSchema,
  replySchema,
  SHARED_THREAD_STATUSES,
} from "@/modules/teaminbox/schemas";

describe("teaminbox schemas", () => {
  it("inboxSchema requires a valid email", () => {
    const ok = inboxSchema.parse({ name: "Support", address: "support@example.com" });
    expect(ok.address).toBe("support@example.com");
    expect(() => inboxSchema.parse({ name: "X", address: "not-an-email" })).toThrow();
  });

  it("threadSchema validates required fields", () => {
    const t = threadSchema.parse({
      inboxId: "abc",
      fromName: "Alice",
      fromEmail: "alice@example.com",
      subject: "Help",
      body: "I need help",
    });
    expect(t.subject).toBe("Help");
    expect(() =>
      threadSchema.parse({
        inboxId: "abc",
        fromName: "",
        fromEmail: "a@b.co",
        subject: "X",
        body: "Y",
      }),
    ).toThrow();
  });

  it("replySchema defaults direction to OUT and accepts NOTE", () => {
    expect(replySchema.parse({ body: "ok" }).direction).toBe("OUT");
    expect(replySchema.parse({ body: "ok", direction: "NOTE" }).direction).toBe("NOTE");
  });

  it("status list is the canonical 3 values", () => {
    expect([...SHARED_THREAD_STATUSES]).toEqual(["OPEN", "PENDING", "CLOSED"]);
  });
});
