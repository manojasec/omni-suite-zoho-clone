import { describe, expect, it } from "vitest";
import {
  applicationCreateSchema,
  applicationUpdateSchema,
  candidateSchema,
  interviewSchema,
  isValidStageTransition,
  jobOpeningSchema,
  pipelineCounts,
} from "@/modules/recruit/schemas";

describe("jobOpeningSchema", () => {
  it("rejects salaryMin > salaryMax", () => {
    const r = jobOpeningSchema.safeParse({
      title: "Engineer", employment: "FULL_TIME", status: "OPEN",
      salaryMin: "200000", salaryMax: "100000", currency: "USD", openings: "1",
    });
    expect(r.success).toBe(false);
  });
  it("accepts valid range and defaults", () => {
    const r = jobOpeningSchema.safeParse({ title: "Engineer", employment: "FULL_TIME", status: "OPEN", currency: "USD", openings: "2" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.openings).toBe(2);
  });
  it("rejects invalid currency", () => {
    const r = jobOpeningSchema.safeParse({ title: "T", employment: "FULL_TIME", status: "OPEN", currency: "usd", openings: "1" });
    expect(r.success).toBe(false);
  });
  it("rejects openings < 1", () => {
    const r = jobOpeningSchema.safeParse({ title: "T", employment: "FULL_TIME", status: "OPEN", currency: "USD", openings: "0" });
    expect(r.success).toBe(false);
  });
});

describe("candidateSchema", () => {
  it("lowercases email", () => {
    const r = candidateSchema.safeParse({ firstName: "Ada", lastName: "Lovelace", email: "Ada@Example.COM" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("ada@example.com");
  });
  it("validates linkedinUrl when present", () => {
    const r = candidateSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.co", linkedinUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });
  it("accepts empty optional url", () => {
    const r = candidateSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.co", linkedinUrl: "" });
    expect(r.success).toBe(true);
  });
});

describe("applicationCreateSchema", () => {
  it("requires jobId and candidateId", () => {
    const r = applicationCreateSchema.safeParse({ jobId: "", candidateId: "" });
    expect(r.success).toBe(false);
  });
  it("rejects rating out of range", () => {
    const r = applicationCreateSchema.safeParse({ jobId: "j", candidateId: "c", rating: "9" });
    expect(r.success).toBe(false);
  });
});

describe("applicationUpdateSchema", () => {
  it("requires valid stage", () => {
    const r = applicationUpdateSchema.safeParse({ stage: "BOGUS" });
    expect(r.success).toBe(false);
  });
  it("accepts rating 1-5", () => {
    const r = applicationUpdateSchema.safeParse({ stage: "OFFER", rating: "5" });
    expect(r.success).toBe(true);
  });
});

describe("interviewSchema", () => {
  it("rejects durationMins < 5", () => {
    const r = interviewSchema.safeParse({ kind: "VIDEO", scheduledAt: "2030-01-01T10:00", durationMins: "1" });
    expect(r.success).toBe(false);
  });
  it("rejects durationMins > 480", () => {
    const r = interviewSchema.safeParse({ kind: "VIDEO", scheduledAt: "2030-01-01T10:00", durationMins: "999" });
    expect(r.success).toBe(false);
  });
  it("rejects invalid outcome", () => {
    const r = interviewSchema.safeParse({ kind: "VIDEO", scheduledAt: "2030-01-01T10:00", durationMins: "30", outcome: "MAYBE" });
    expect(r.success).toBe(false);
  });
  it("coerces scheduledAt to Date", () => {
    const r = interviewSchema.safeParse({ kind: "PHONE", scheduledAt: "2030-01-01T10:00", durationMins: "30" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.scheduledAt).toBeInstanceOf(Date);
  });
});

describe("pipelineCounts", () => {
  it("returns zeros for empty input with all 7 keys", () => {
    const c = pipelineCounts([]);
    expect(Object.keys(c).sort()).toEqual(
      ["APPLIED", "HIRED", "INTERVIEW", "OFFER", "REJECTED", "SCREEN", "WITHDRAWN"],
    );
    expect(c.APPLIED).toBe(0);
  });
  it("counts stages correctly", () => {
    const c = pipelineCounts([
      { stage: "APPLIED" }, { stage: "APPLIED" }, { stage: "OFFER" }, { stage: "HIRED" }, { stage: "REJECTED" },
    ]);
    expect(c.APPLIED).toBe(2);
    expect(c.OFFER).toBe(1);
    expect(c.HIRED).toBe(1);
    expect(c.REJECTED).toBe(1);
    expect(c.SCREEN).toBe(0);
  });
});

describe("isValidStageTransition", () => {
  it("allows same stage", () => {
    expect(isValidStageTransition("APPLIED", "APPLIED")).toBe(true);
  });
  it("forbids transitions out of HIRED", () => {
    expect(isValidStageTransition("HIRED", "APPLIED")).toBe(false);
    expect(isValidStageTransition("HIRED", "OFFER")).toBe(false);
  });
  it("forbids transitions out of WITHDRAWN", () => {
    expect(isValidStageTransition("WITHDRAWN", "APPLIED")).toBe(false);
  });
  it("allows REJECTED -> APPLIED only", () => {
    expect(isValidStageTransition("REJECTED", "APPLIED")).toBe(true);
    expect(isValidStageTransition("REJECTED", "SCREEN")).toBe(false);
  });
  it("allows APPLIED -> SCREEN", () => {
    expect(isValidStageTransition("APPLIED", "SCREEN")).toBe(true);
  });
  it("allows OFFER -> HIRED", () => {
    expect(isValidStageTransition("OFFER", "HIRED")).toBe(true);
  });
});
