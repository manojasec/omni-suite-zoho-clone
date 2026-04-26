import { describe, it, expect } from "vitest";
import {
  eventSchema,
  eventSessionSchema,
  registrationSchema,
  generateTicketCode,
  slugify,
  EVENT_STATUSES,
} from "@/modules/events/schemas";

const baseEvent = {
  title: "DevConf 2026",
  slug: "devconf-2026",
  isVirtual: "on",
  status: "DRAFT",
  startsAt: "2026-09-15T09:00",
  endsAt: "2026-09-15T17:00",
};

describe("events schemas", () => {
  it("accepts a well-formed event", () => {
    const r = eventSchema.safeParse(baseEvent);
    expect(r.success).toBe(true);
  });

  it("rejects events whose end is before start", () => {
    const r = eventSchema.safeParse({
      ...baseEvent,
      startsAt: "2026-09-15T17:00",
      endsAt: "2026-09-15T09:00",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const r = eventSchema.safeParse({ ...baseEvent, title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid slugs", () => {
    const r = eventSchema.safeParse({ ...baseEvent, slug: "not a slug!" });
    expect(r.success).toBe(false);
  });

  it("coerces empty optional fields to undefined", () => {
    const r = eventSchema.safeParse({
      ...baseEvent,
      summary: "",
      description: "",
      location: "",
      meetingUrl: "",
      capacity: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.summary).toBeUndefined();
      expect(r.data.location).toBeUndefined();
      expect(r.data.capacity).toBeUndefined();
    }
  });

  it("parses checkbox truthiness for isVirtual", () => {
    const on = eventSchema.safeParse({ ...baseEvent, isVirtual: "on" });
    const off = eventSchema.safeParse({ ...baseEvent, isVirtual: null });
    expect(on.success && on.data.isVirtual).toBe(true);
    expect(off.success && off.data.isVirtual).toBe(false);
  });

  it("validates session times", () => {
    const ok = eventSessionSchema.safeParse({
      title: "Keynote",
      startsAt: "2026-09-15T09:00",
      endsAt: "2026-09-15T10:00",
    });
    expect(ok.success).toBe(true);
    const bad = eventSessionSchema.safeParse({
      title: "Keynote",
      startsAt: "2026-09-15T10:00",
      endsAt: "2026-09-15T10:00",
    });
    expect(bad.success).toBe(false);
  });

  it("validates registration emails", () => {
    expect(registrationSchema.safeParse({ name: "Ada", email: "ada@example.com" }).success).toBe(true);
    expect(registrationSchema.safeParse({ name: "Ada", email: "not-an-email" }).success).toBe(false);
    expect(registrationSchema.safeParse({ name: "", email: "ada@example.com" }).success).toBe(false);
  });

  it("generates unique ticket codes shaped like XXXXX-XXXXX", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) set.add(generateTicketCode());
    expect(set.size).toBe(50);
    for (const code of set) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
  });

  it("slugifies arbitrary titles", () => {
    expect(slugify("DevConf 2026!")).toBe("devconf-2026");
    expect(slugify("  Hello   World  ")).toBe("hello-world");
    expect(slugify("---weird---")).toBe("weird");
  });

  it("exposes the expected status enum", () => {
    expect(EVENT_STATUSES).toEqual(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]);
  });
});
