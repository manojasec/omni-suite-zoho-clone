import { describe, it, expect } from "vitest";
import { buildIcs, escapeIcsText, foldLine, toIcsUtc } from "@/modules/bookings/ics";

describe("bookings ics", () => {
  it("toIcsUtc emits compact UTC stamp", () => {
    const d = new Date("2026-04-30T09:05:07.000Z");
    expect(toIcsUtc(d)).toBe("20260430T090507Z");
  });

  it("escapeIcsText escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("foldLine wraps lines longer than 75 octets with CRLF + space", () => {
    const long = "X".repeat(160);
    const folded = foldLine(long);
    expect(folded.includes("\r\n ")).toBe(true);
    expect(folded.split("\r\n").every((l, i) => (i === 0 ? l.length <= 75 : l.length <= 75))).toBe(
      true,
    );
  });

  it("buildIcs produces a VCALENDAR with VEVENT and required fields", () => {
    const ics = buildIcs({
      uid: "abc-123",
      summary: "Demo, with comma",
      description: "Line1\nLine2",
      location: "Zoom",
      startsAt: new Date("2026-05-01T15:00:00Z"),
      endsAt: new Date("2026-05-01T15:30:00Z"),
      organizerEmail: "host@x.com",
      organizerName: "Alice",
      attendeeEmail: "guest@y.com",
      attendeeName: "Bob",
      url: "https://example.com/book",
    });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("UID:abc-123\r\n");
    expect(ics).toContain("DTSTART:20260501T150000Z\r\n");
    expect(ics).toContain("DTEND:20260501T153000Z\r\n");
    expect(ics).toContain("SUMMARY:Demo\\, with comma\r\n");
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2\r\n");
    expect(ics).toContain("LOCATION:Zoom\r\n");
    expect(ics).toContain("ORGANIZER;CN=Alice:mailto:host@x.com\r\n");
    expect(ics).toContain("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Bob:mailto:guest@y.com\r\n");
    expect(ics).toMatch(/END:VEVENT\r\nEND:VCALENDAR\r\n$/);
  });

  it("buildIcs marks status CANCELLED when requested", () => {
    const ics = buildIcs({
      uid: "x",
      summary: "Cancelled",
      startsAt: new Date("2026-05-01T15:00:00Z"),
      endsAt: new Date("2026-05-01T15:30:00Z"),
      status: "CANCELLED",
    });
    expect(ics).toContain("STATUS:CANCELLED");
  });
});
