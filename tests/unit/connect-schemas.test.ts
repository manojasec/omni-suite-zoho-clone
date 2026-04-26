import { describe, it, expect } from "vitest";
import {
  groupSchema,
  postSchema,
  commentSchema,
  slugifyGroup,
  timeAgo,
} from "@/modules/connect/schemas";

describe("connect schemas", () => {
  describe("groupSchema", () => {
    it("accepts a valid group", () => {
      const r = groupSchema.safeParse({ slug: "engineering", name: "Engineering" });
      expect(r.success).toBe(true);
    });

    it("rejects an empty name", () => {
      const r = groupSchema.safeParse({ slug: "ok", name: " " });
      expect(r.success).toBe(false);
    });

    it("rejects an invalid slug", () => {
      const r = groupSchema.safeParse({ slug: "Bad Slug!", name: "X" });
      expect(r.success).toBe(false);
    });

    it("treats empty description as undefined", () => {
      const r = groupSchema.safeParse({ slug: "ok", name: "Ok", description: "" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.description).toBeUndefined();
    });

    it("rejects an over-long name", () => {
      const r = groupSchema.safeParse({ slug: "ok", name: "x".repeat(121) });
      expect(r.success).toBe(false);
    });
  });

  describe("postSchema", () => {
    it("requires a body", () => {
      const r = postSchema.safeParse({ body: "  " });
      expect(r.success).toBe(false);
    });

    it("accepts body without title or group", () => {
      const r = postSchema.safeParse({ body: "Hello team" });
      expect(r.success).toBe(true);
    });

    it("rejects body over 20000 chars", () => {
      const r = postSchema.safeParse({ body: "x".repeat(20_001) });
      expect(r.success).toBe(false);
    });
  });

  describe("commentSchema", () => {
    it("rejects empty comment", () => {
      const r = commentSchema.safeParse({ body: "" });
      expect(r.success).toBe(false);
    });

    it("accepts a normal comment", () => {
      const r = commentSchema.safeParse({ body: "thanks!" });
      expect(r.success).toBe(true);
    });

    it("rejects over-long comment", () => {
      const r = commentSchema.safeParse({ body: "x".repeat(4_001) });
      expect(r.success).toBe(false);
    });
  });

  describe("slugifyGroup", () => {
    it("lowercases and dashes spaces", () => {
      expect(slugifyGroup("Hello World")).toBe("hello-world");
    });

    it("strips invalid chars and trims dashes", () => {
      expect(slugifyGroup("  --Foo!! Bar??--  ")).toBe("foo-bar");
    });

    it("caps at 80 chars", () => {
      const out = slugifyGroup("a".repeat(200));
      expect(out.length).toBe(80);
    });
  });

  describe("timeAgo", () => {
    it("returns seconds for recent times", () => {
      const now = new Date("2024-01-01T00:01:00Z");
      const past = new Date("2024-01-01T00:00:30Z");
      expect(timeAgo(past, now)).toBe("30s");
    });

    it("returns days for ~3 days ago", () => {
      const now = new Date("2024-01-10T00:00:00Z");
      const past = new Date("2024-01-07T00:00:00Z");
      expect(timeAgo(past, now)).toBe("3d");
    });
  });
});
