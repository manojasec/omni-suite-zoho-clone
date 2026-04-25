import { describe, expect, it } from "vitest";
import { ticketSchema, ticketStatusSchema, ticketMessageSchema } from "@/modules/helpdesk/schemas";

describe("helpdesk/schemas — ticketSchema", () => {
  it("requires a subject", () => {
    expect(ticketSchema.safeParse({ subject: "" }).success).toBe(false);
    expect(ticketSchema.safeParse({ subject: "Login broken" }).success).toBe(true);
  });

  it("defaults status OPEN, priority MEDIUM, channel web", () => {
    const r = ticketSchema.parse({ subject: "x" });
    expect(r.status).toBe("OPEN");
    expect(r.priority).toBe("MEDIUM");
    expect(r.channel).toBe("web");
    expect(r.tags).toEqual([]);
  });

  it("parses comma-separated tags", () => {
    const r = ticketSchema.parse({ subject: "x", tags: "billing, urgent, vip" });
    expect(r.tags).toEqual(["billing", "urgent", "vip"]);
  });

  it("rejects an invalid status", () => {
    expect(ticketSchema.safeParse({ subject: "x", status: "BOGUS" }).success).toBe(false);
  });
});

describe("helpdesk/schemas — ticketStatusSchema", () => {
  it("only allows known statuses", () => {
    expect(ticketStatusSchema.safeParse({ status: "RESOLVED" }).success).toBe(true);
    expect(ticketStatusSchema.safeParse({ status: "BOGUS" }).success).toBe(false);
  });
});

describe("helpdesk/schemas — ticketMessageSchema", () => {
  it("requires non-empty body", () => {
    expect(ticketMessageSchema.safeParse({ body: "", isInternal: false }).success).toBe(false);
    expect(ticketMessageSchema.safeParse({ body: "Thanks!", isInternal: false }).success).toBe(true);
  });

  it("normalises checkbox-like values for isInternal", () => {
    expect(ticketMessageSchema.parse({ body: "x", isInternal: "on" }).isInternal).toBe(true);
    expect(ticketMessageSchema.parse({ body: "x", isInternal: "" }).isInternal).toBe(false);
    expect(ticketMessageSchema.parse({ body: "x" }).isInternal).toBe(false);
  });
});
