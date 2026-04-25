import { describe, expect, it } from "vitest";
import {
  addTagToList,
  computeNextRunAt,
  enrollContactSchema,
  workflowSchema,
  workflowStepSchema,
} from "@/modules/automation/schemas";

describe("workflowSchema", () => {
  it("accepts a minimal workflow", () => {
    const r = workflowSchema.safeParse({ name: "Welcome series" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.trigger).toBe("MANUAL");
  });

  it("rejects empty name", () => {
    expect(workflowSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("workflowStepSchema", () => {
  it("accepts a valid SEND_EMAIL step", () => {
    expect(
      workflowStepSchema.safeParse({
        type: "SEND_EMAIL",
        emailSubject: "Welcome",
        emailHtml: "<p>Hi</p>",
      }).success,
    ).toBe(true);
  });

  it("requires subject + html for SEND_EMAIL", () => {
    expect(workflowStepSchema.safeParse({ type: "SEND_EMAIL" }).success).toBe(false);
    expect(
      workflowStepSchema.safeParse({ type: "SEND_EMAIL", emailSubject: "Hi" }).success,
    ).toBe(false);
  });

  it("requires waitDays for WAIT_DAYS", () => {
    expect(workflowStepSchema.safeParse({ type: "WAIT_DAYS" }).success).toBe(false);
    expect(workflowStepSchema.safeParse({ type: "WAIT_DAYS", waitDays: 3 }).success).toBe(true);
  });

  it("rejects waitDays out of range", () => {
    expect(workflowStepSchema.safeParse({ type: "WAIT_DAYS", waitDays: 0 }).success).toBe(false);
    expect(workflowStepSchema.safeParse({ type: "WAIT_DAYS", waitDays: 400 }).success).toBe(false);
  });

  it("requires tag for ADD_TAG", () => {
    expect(workflowStepSchema.safeParse({ type: "ADD_TAG" }).success).toBe(false);
    expect(workflowStepSchema.safeParse({ type: "ADD_TAG", tag: "vip" }).success).toBe(true);
  });
});

describe("enrollContactSchema", () => {
  it("requires a contactId", () => {
    expect(enrollContactSchema.safeParse({ contactId: "" }).success).toBe(false);
    expect(enrollContactSchema.safeParse({ contactId: "c1" }).success).toBe(true);
  });
});

describe("computeNextRunAt", () => {
  it("returns now for non-wait steps", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    expect(computeNextRunAt("SEND_EMAIL", null, now).getTime()).toBe(now.getTime());
    expect(computeNextRunAt("ADD_TAG", null, now).getTime()).toBe(now.getTime());
  });

  it("adds days for WAIT_DAYS", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const next = computeNextRunAt("WAIT_DAYS", 3, now);
    expect(next.toISOString()).toBe("2025-01-04T00:00:00.000Z");
  });

  it("falls back to now if waitDays is missing", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    expect(computeNextRunAt("WAIT_DAYS", null, now).getTime()).toBe(now.getTime());
  });
});

describe("addTagToList", () => {
  it("adds new tag in lowercase", () => {
    expect(addTagToList(["a"], "B")).toEqual(["a", "b"]);
  });

  it("returns null when tag already present (case-insensitive)", () => {
    expect(addTagToList(["vip"], "VIP")).toBeNull();
  });

  it("handles non-array existing values", () => {
    expect(addTagToList(null, "x")).toEqual(["x"]);
    expect(addTagToList(undefined, "x")).toEqual(["x"]);
  });

  it("ignores blank tags", () => {
    expect(addTagToList(["a"], "  ")).toBeNull();
  });
});
