import { describe, expect, it } from "vitest";
import {
  composeMailSchema,
  makeSnippet,
  moveMailSchema,
  parseAddressList,
  replyMailSchema,
} from "@/modules/mail/schemas";

describe("parseAddressList", () => {
  it("splits on commas, semicolons, and newlines", () => {
    expect(parseAddressList("a@x.com, b@x.com; c@x.com\n d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("dedupes case-insensitively", () => {
    expect(parseAddressList("A@x.com, a@x.com, B@X.com")).toEqual(["A@x.com", "B@X.com"]);
  });

  it("handles empty/null input", () => {
    expect(parseAddressList("")).toEqual([]);
    expect(parseAddressList(null)).toEqual([]);
    expect(parseAddressList(undefined)).toEqual([]);
  });
});

describe("makeSnippet", () => {
  it("strips HTML tags and collapses whitespace", () => {
    expect(makeSnippet("<p>Hello   <b>world</b></p>")).toBe("Hello world");
  });

  it("removes <style> blocks", () => {
    expect(makeSnippet("<style>p{color:red}</style><p>Hi</p>")).toBe("Hi");
  });

  it("truncates long content with ellipsis", () => {
    const out = makeSnippet("a".repeat(200), 50);
    expect(out.length).toBe(50);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("composeMailSchema", () => {
  const base = {
    to: "user@example.com",
    subject: "Hello",
    body: "Hi there",
  };

  it("accepts a valid payload", () => {
    expect(composeMailSchema.safeParse(base).success).toBe(true);
  });

  it("requires a non-empty recipient list", () => {
    expect(composeMailSchema.safeParse({ ...base, to: "" }).success).toBe(false);
  });

  it("rejects invalid recipient addresses", () => {
    expect(
      composeMailSchema.safeParse({ ...base, to: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects oversize body", () => {
    expect(
      composeMailSchema.safeParse({ ...base, body: "x".repeat(50_001) }).success,
    ).toBe(false);
  });

  it("rejects empty subject", () => {
    expect(composeMailSchema.safeParse({ ...base, subject: "" }).success).toBe(false);
  });

  it("validates cc/bcc when supplied", () => {
    expect(
      composeMailSchema.safeParse({ ...base, cc: "bad-address" }).success,
    ).toBe(false);
    expect(
      composeMailSchema.safeParse({ ...base, cc: "ok@example.com" }).success,
    ).toBe(true);
  });
});

describe("replyMailSchema", () => {
  it("requires a body", () => {
    expect(replyMailSchema.safeParse({ body: "" }).success).toBe(false);
    expect(replyMailSchema.safeParse({ body: "ok" }).success).toBe(true);
  });
});

describe("moveMailSchema", () => {
  it("accepts known folders", () => {
    expect(moveMailSchema.safeParse({ folder: "ARCHIVE" }).success).toBe(true);
  });

  it("rejects unknown folders", () => {
    expect(moveMailSchema.safeParse({ folder: "JUNK" }).success).toBe(false);
  });
});
