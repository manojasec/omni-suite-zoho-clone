import { describe, it, expect } from "vitest";
import {
  htmlToMarkdown,
  sanitizeRichHtml,
  stripRichHtml,
} from "@/platform/views/richtext";

describe("sanitizeRichHtml", () => {
  it("keeps allowlisted tags", () => {
    const out = sanitizeRichHtml("<p>Hi <strong>there</strong></p>");
    expect(out).toContain("<strong>there</strong>");
  });

  it("strips <script> entirely (tag + text)", () => {
    const out = sanitizeRichHtml("<p>safe</p><script>alert(1)</script>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("drops javascript: hrefs", () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).toContain("<a>");
    expect(out).not.toContain("javascript");
  });

  it("keeps http/mailto hrefs", () => {
    expect(sanitizeRichHtml('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
    expect(sanitizeRichHtml('<a href="mailto:a@b.co">a</a>')).toContain('href="mailto:a@b.co"');
  });

  it("coerces <b>/<i> to <strong>/<em>", () => {
    expect(sanitizeRichHtml("<b>x</b>")).toBe("<strong>x</strong>");
    expect(sanitizeRichHtml("<i>x</i>")).toBe("<em>x</em>");
  });

  it("strips disallowed attributes (onclick, style)", () => {
    const out = sanitizeRichHtml('<p onclick="x" style="color:red">hi</p>');
    expect(out).toBe("<p>hi</p>");
  });

  it("strips unknown tags but keeps inner text", () => {
    const out = sanitizeRichHtml("<div><span>hello</span></div>");
    expect(out).toBe("hello");
  });

  it("escapes lone < and > in text", () => {
    expect(sanitizeRichHtml("a < b > c")).toContain("&lt;");
  });

  it("closes unclosed tags", () => {
    const out = sanitizeRichHtml("<p>hi");
    expect(out).toBe("<p>hi</p>");
  });
});

describe("htmlToMarkdown", () => {
  it("renders headings, bold, links", () => {
    const md = htmlToMarkdown(
      '<h1>Title</h1><p>Hello <strong>world</strong> <a href="https://x.com">link</a></p>',
    );
    expect(md).toContain("# Title");
    expect(md).toContain("**world**");
    expect(md).toContain("[link](https://x.com)");
  });
});

describe("stripRichHtml", () => {
  it("returns plain text with collapsed whitespace", () => {
    const out = stripRichHtml("<p>Hello   <strong>world</strong></p>");
    expect(out).toBe("Hello world");
  });
});
