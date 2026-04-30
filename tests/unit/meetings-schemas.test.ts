import { describe, it, expect } from "vitest";
import {
  generateJoinCode,
  meetingSchema,
  MEETING_KINDS,
} from "@/modules/meetings/schemas";

describe("meetings schemas", () => {
  it("generateJoinCode has correct format XXX-XXX-XXX", () => {
    for (let i = 0; i < 25; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    }
  });

  it("meetingSchema accepts a valid meeting", () => {
    const result = meetingSchema.parse({
      kind: "MEETING",
      title: "Sync",
      scheduledAt: "2025-01-15T10:00:00Z",
      durationMin: 30,
      attendeeLimit: 50,
    });
    expect(result.title).toBe("Sync");
    expect(result.durationMin).toBe(30);
  });

  it("meetingSchema rejects empty title and oversize durations", () => {
    expect(() =>
      meetingSchema.parse({
        kind: "MEETING",
        title: "",
        scheduledAt: "2025-01-15T10:00:00Z",
      }),
    ).toThrow();
    expect(() =>
      meetingSchema.parse({
        kind: "MEETING",
        title: "ok",
        scheduledAt: "2025-01-15T10:00:00Z",
        durationMin: 9999,
      }),
    ).toThrow();
  });

  it("MEETING_KINDS includes WEBINAR", () => {
    expect(MEETING_KINDS).toContain("WEBINAR");
  });
});
