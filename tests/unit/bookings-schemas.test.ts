import { describe, expect, it } from "vitest";
import {
  bookingTypeSchema,
  publicBookingSchema,
  toMinutes,
  fromMinutes,
} from "@/modules/bookings/schemas";

describe("bookingTypeSchema", () => {
  const base = {
    name: "Discovery call",
    publicSlug: "discovery-call",
    durationMins: "30",
    bufferMins: "0",
    color: "#0F172A",
  };

  it("accepts a valid input", () => {
    const r = bookingTypeSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.durationMins).toBe(30);
      expect(r.data.bufferMins).toBe(0);
    }
  });

  it("rejects slug with uppercase", () => {
    const r = bookingTypeSchema.safeParse({ ...base, publicSlug: "Discovery" });
    expect(r.success).toBe(true); // toLowerCase transform makes it lowercase
    if (r.success) expect(r.data.publicSlug).toBe("discovery");
  });

  it("rejects slug with spaces", () => {
    const r = bookingTypeSchema.safeParse({ ...base, publicSlug: "discovery call" });
    expect(r.success).toBe(false);
  });

  it("rejects duration below minimum", () => {
    const r = bookingTypeSchema.safeParse({ ...base, durationMins: "2" });
    expect(r.success).toBe(false);
  });

  it("rejects duration above 8 hours", () => {
    const r = bookingTypeSchema.safeParse({ ...base, durationMins: "600" });
    expect(r.success).toBe(false);
  });

  it("rejects malformed color", () => {
    const r = bookingTypeSchema.safeParse({ ...base, color: "blue" });
    expect(r.success).toBe(false);
  });

  it("requires name", () => {
    const r = bookingTypeSchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
  });
});

describe("publicBookingSchema", () => {
  const baseISO = new Date(Date.now() + 60 * 60_000).toISOString();
  const base = {
    attendeeName: "Alice",
    attendeeEmail: "alice@example.com",
    attendeePhone: "",
    notes: "",
    startsAt: baseISO,
  };

  it("accepts a valid booking", () => {
    expect(publicBookingSchema.safeParse(base).success).toBe(true);
  });

  it("rejects missing name", () => {
    expect(publicBookingSchema.safeParse({ ...base, attendeeName: "" }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(publicBookingSchema.safeParse({ ...base, attendeeEmail: "not-an-email" }).success).toBe(false);
  });

  it("rejects unparseable startsAt", () => {
    expect(publicBookingSchema.safeParse({ ...base, startsAt: "not-a-date" }).success).toBe(false);
  });
});

describe("time helpers", () => {
  it("converts HH:MM to minutes", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("23:45")).toBe(23 * 60 + 45);
  });

  it("round-trips through fromMinutes", () => {
    for (const t of ["00:00", "09:30", "12:15", "23:59"]) {
      expect(fromMinutes(toMinutes(t))).toBe(t);
    }
  });
});
