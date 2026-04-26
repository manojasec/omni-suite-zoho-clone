import { describe, it, expect } from "vitest";
import {
  siteSchema,
  sitePageSchema,
  slugify,
  renderSiteMarkdown,
  SITE_PAGE_STATUSES,
} from "@/modules/sites/schemas";

describe("sites schemas", () => {
  it("accepts a valid site", () => {
    const r = siteSchema.safeParse({
      slug: "marketing",
      name: "Marketing",
      themeColor: "#0f172a",
    });
    expect(r.success).toBe(true);
  });

  it("rejects bad slug or hex color", () => {
    expect(siteSchema.safeParse({ slug: "Bad Slug!", name: "x" }).success).toBe(false);
    expect(siteSchema.safeParse({ slug: "ok", name: "x", themeColor: "blue" }).success).toBe(false);
    expect(siteSchema.safeParse({ slug: "", name: "x" }).success).toBe(false);
  });

  it("coerces blank description to undefined and applies default theme color", () => {
    const r = siteSchema.safeParse({ slug: "ok", name: "x", description: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBeUndefined();
      expect(r.data.themeColor).toBe("#0f172a");
    }
  });

  it("validates site page input", () => {
    expect(
      sitePageSchema.safeParse({ slug: "home", title: "Home", body: "# hi", status: "DRAFT" }).success,
    ).toBe(true);
    expect(sitePageSchema.safeParse({ slug: "Home!", title: "x", body: "" }).success).toBe(false);
    expect(sitePageSchema.safeParse({ slug: "ok", title: "", body: "" }).success).toBe(false);
  });

  it("exposes status enum", () => {
    expect(SITE_PAGE_STATUSES).toEqual(["DRAFT", "PUBLISHED"]);
  });

  it("slugifies arbitrary input", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("  Foo   Bar  ")).toBe("foo-bar");
    expect(slugify("---weird---")).toBe("weird");
    expect(slugify("a".repeat(120)).length).toBeLessThanOrEqual(80);
  });
});

describe("renderSiteMarkdown", () => {
  it("escapes raw html to prevent XSS", () => {
    const out = renderSiteMarkdown("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders headings, paragraphs, and dividers", () => {
    const out = renderSiteMarkdown("# Title\n\nHello world.\n\n---\n\n## Sub");
    expect(out).toContain("<h1>Title</h1>");
    expect(out).toContain("<p>Hello world.</p>");
    expect(out).toContain("<hr />");
    expect(out).toContain("<h2>Sub</h2>");
  });

  it("renders bold, italic, and safe links", () => {
    const out = renderSiteMarkdown("**big** and *small* and [go](https://example.com)");
    expect(out).toContain("<strong>big</strong>");
    expect(out).toContain("<em>small</em>");
    expect(out).toContain('<a href="https://example.com" rel="noopener noreferrer">go</a>');
  });

  it("does not link unsafe protocols", () => {
    const out = renderSiteMarkdown("[x](javascript:alert(1))");
    expect(out).not.toContain("<a ");
    expect(out).toContain("[x]");
  });
});
