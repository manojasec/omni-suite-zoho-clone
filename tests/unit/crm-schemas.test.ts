import { describe, expect, it } from "vitest";
import { contactSchema, companySchema, activitySchema } from "@/modules/crm/schemas";

describe("crm/schemas — contactSchema", () => {
  it("accepts a minimal valid contact", () => {
    const r = contactSchema.parse({ firstName: "Ada" });
    expect(r.firstName).toBe("Ada");
    expect(r.lifecycleStage).toBe("LEAD");
    expect(r.tags).toEqual([]);
    expect(r.email).toBeNull();
  });

  it("trims and lowercases the email", () => {
    const r = contactSchema.parse({ firstName: "Ada", email: "  ADA@Example.COM  " });
    expect(r.email).toBe("ada@example.com");
  });

  it("rejects an invalid email", () => {
    const r = contactSchema.safeParse({ firstName: "Ada", email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("parses tags from a comma-separated string", () => {
    const r = contactSchema.parse({
      firstName: "Ada",
      tags: " vip , enterprise ,, partner ",
    });
    expect(r.tags).toEqual(["vip", "enterprise", "partner"]);
  });

  it("requires a first name", () => {
    const r = contactSchema.safeParse({ firstName: "  " });
    expect(r.success).toBe(false);
  });

  it("rejects unknown lifecycle stages", () => {
    const r = contactSchema.safeParse({ firstName: "Ada", lifecycleStage: "BOGUS" });
    expect(r.success).toBe(false);
  });

  it("turns empty optional strings into null", () => {
    const r = contactSchema.parse({ firstName: "Ada", phone: "", title: "" });
    expect(r.phone).toBeNull();
    expect(r.title).toBeNull();
  });
});

describe("crm/schemas — companySchema", () => {
  it("requires a name", () => {
    expect(companySchema.safeParse({ name: "" }).success).toBe(false);
    expect(companySchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("normalises empty optionals to null", () => {
    const r = companySchema.parse({ name: "Acme", domain: "", industry: "" });
    expect(r.domain).toBeNull();
    expect(r.industry).toBeNull();
  });
});

describe("crm/schemas — activitySchema", () => {
  it("accepts a minimal NOTE", () => {
    const r = activitySchema.parse({ type: "NOTE", subject: "Called Ada" });
    expect(r.type).toBe("NOTE");
    expect(r.subject).toBe("Called Ada");
  });

  it("requires a subject", () => {
    const r = activitySchema.safeParse({ type: "NOTE", subject: "  " });
    expect(r.success).toBe(false);
  });

  it("rejects unknown activity types", () => {
    const r = activitySchema.safeParse({ type: "TWEET", subject: "x" });
    expect(r.success).toBe(false);
  });

  it("parses dueAt to a Date", () => {
    const r = activitySchema.parse({
      type: "TASK",
      subject: "Follow up",
      dueAt: "2026-05-01T10:00:00.000Z",
    });
    expect(r.dueAt).toBeInstanceOf(Date);
  });
});
