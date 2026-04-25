import { describe, expect, it } from "vitest";
import {
  canTransition,
  issueCommentSchema,
  issueProjectSchema,
  issueSchema,
  normaliseTags,
} from "@/modules/bugs/schemas";

describe("issueProjectSchema", () => {
  it("accepts a valid project", () => {
    const r = issueProjectSchema.safeParse({ name: "Web", key: "WEB" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.key).toBe("WEB");
  });

  it("uppercases the key", () => {
    const r = issueProjectSchema.safeParse({ name: "Web", key: "web" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.key).toBe("WEB");
  });

  it("rejects key with leading digit", () => {
    expect(issueProjectSchema.safeParse({ name: "Web", key: "1WEB" }).success).toBe(false);
  });

  it("rejects key longer than 6", () => {
    expect(issueProjectSchema.safeParse({ name: "Web", key: "TOOLONG" }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(issueProjectSchema.safeParse({ name: "", key: "WEB" }).success).toBe(false);
  });
});

describe("issueSchema", () => {
  const base = { projectId: "p1", title: "Crash on login" };

  it("accepts minimal input with defaults", () => {
    const r = issueSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.type).toBe("BUG");
      expect(r.data.priority).toBe("MEDIUM");
      expect(r.data.severity).toBe("MINOR");
    }
  });

  it("rejects missing title", () => {
    expect(issueSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("rejects unknown type", () => {
    expect(issueSchema.safeParse({ ...base, type: "WAT" }).success).toBe(false);
  });

  it("rejects unknown priority", () => {
    expect(issueSchema.safeParse({ ...base, priority: "OMG" }).success).toBe(false);
  });
});

describe("issueCommentSchema", () => {
  it("accepts a non-empty comment", () => {
    expect(issueCommentSchema.safeParse({ body: "hello" }).success).toBe(true);
  });

  it("rejects empty/whitespace", () => {
    expect(issueCommentSchema.safeParse({ body: "  " }).success).toBe(false);
  });

  it("rejects very long comments", () => {
    expect(issueCommentSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("normaliseTags", () => {
  it("dedupes and lowercases", () => {
    expect(normaliseTags("Frontend, Bug, frontend")).toBe("frontend,bug");
  });

  it("returns undefined for empty input", () => {
    expect(normaliseTags("")).toBeUndefined();
    expect(normaliseTags(null)).toBeUndefined();
    expect(normaliseTags(undefined)).toBeUndefined();
  });

  it("caps to 10 tags", () => {
    const inp = Array.from({ length: 20 }, (_, i) => `t${i}`).join(",");
    expect(normaliseTags(inp)?.split(",").length).toBe(10);
  });

  it("drops tags longer than 32 chars", () => {
    expect(normaliseTags("ok," + "x".repeat(33))).toBe("ok");
  });
});

describe("canTransition", () => {
  it("allows allowed transitions", () => {
    expect(canTransition("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
    expect(canTransition("RESOLVED", "CLOSED")).toBe(true);
    expect(canTransition("CLOSED", "REOPENED")).toBe(true);
    expect(canTransition("REOPENED", "RESOLVED")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(canTransition("CLOSED", "OPEN")).toBe(false);
    expect(canTransition("OPEN", "REOPENED")).toBe(false);
    expect(canTransition("RESOLVED", "OPEN")).toBe(false);
  });

  it("treats same-state as allowed (no-op)", () => {
    expect(canTransition("OPEN", "OPEN")).toBe(true);
  });
});
