import { describe, it, expect } from "vitest";
import { buildOutboundDraft } from "@/modules/mail/outbound";

describe("mail outbound draft builder", () => {
  it("parses comma-separated recipients into normalized arrays", () => {
    const d = buildOutboundDraft("me@example.com", {
      to: "alice@example.com, bob@example.com",
      subject: "Hi",
      body: "Hello team",
    });
    expect(d.recipients.to).toEqual(["alice@example.com", "bob@example.com"]);
    expect(d.recipients.cc).toEqual([]);
    expect(d.message.toAddresses).toEqual(["alice@example.com", "bob@example.com"]);
    expect(d.message.direction).toBe("OUTBOUND");
  });

  it("dedupes recipients case-insensitively", () => {
    const d = buildOutboundDraft("me@example.com", {
      to: "Alice@example.com, alice@example.com",
      subject: "x",
      body: "y",
    });
    expect(d.recipients.to).toHaveLength(1);
  });

  it("collects participants from from + to + cc + bcc, unique", () => {
    const d = buildOutboundDraft("me@example.com", {
      to: "a@x.com",
      cc: "b@x.com",
      bcc: "c@x.com, me@example.com",
      subject: "S",
      body: "B",
    });
    expect(d.thread.participants).toEqual([
      "me@example.com",
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });

  it("places drafts into SENT folder, not unread", () => {
    const d = buildOutboundDraft("me@example.com", { to: "x@y.com", subject: "S", body: "Body" });
    expect(d.thread.folder).toBe("SENT");
    expect(d.thread.isUnread).toBe(false);
  });

  it("snippet trims and previews body", () => {
    const long = "Line one\n\nLine two".repeat(40);
    const d = buildOutboundDraft("me@example.com", { to: "x@y.com", subject: "S", body: long });
    expect(d.thread.snippet.length).toBeLessThanOrEqual(120);
  });

  it("throws when no recipients at all", () => {
    expect(() =>
      buildOutboundDraft("me@example.com", { to: "", subject: "S", body: "B" }),
    ).toThrow(/recipient/i);
  });

  it("uses provided now for lastMessageAt", () => {
    const now = new Date("2026-05-09T12:00:00Z");
    const d = buildOutboundDraft("me@example.com", { to: "x@y.com", subject: "S", body: "B" }, now);
    expect(d.thread.lastMessageAt.toISOString()).toBe(now.toISOString());
  });
});
