import { describe, it, expect } from "vitest";
import { buildEmbedResizeJs, buildEmbedSnippet, buildLoaderJs } from "@/modules/forms/embed";

describe("forms embed — snippet", () => {
  it("emits a div with publicId and an async script", () => {
    const html = buildEmbedSnippet({ publicId: "form-123", origin: "https://app.example.com" });
    expect(html).toContain('data-zc-form="form-123"');
    expect(html).toContain('data-zc-height="600"');
    expect(html).toContain("https://app.example.com/api/forms/widget.js");
    expect(html).toMatch(/<script async/);
  });

  it("uses custom height when provided", () => {
    const html = buildEmbedSnippet({ publicId: "x", origin: "https://app", height: 1024 });
    expect(html).toContain('data-zc-height="1024"');
  });

  it("escapes attributes against injection", () => {
    const html = buildEmbedSnippet({ publicId: 'a"b', origin: "https://app" });
    expect(html).toContain('data-zc-form="a&quot;b"');
  });

  it("strips trailing slash from origin in the script src", () => {
    const html = buildEmbedSnippet({ publicId: "x", origin: "https://app.example.com/" });
    expect(html).toContain("https://app.example.com/api/forms/widget.js");
  });
});

describe("forms embed — loader JS", () => {
  it("hardcodes the trusted origin and listens for resize messages", () => {
    const js = buildLoaderJs({ origin: "https://app.example.com" });
    expect(js).toContain('"https://app.example.com"');
    expect(js).toContain("zc-form-resize");
    expect(js).toContain('addEventListener("message"');
    // Origin check before processing the message
    expect(js).toContain("ev.origin !== ORIGIN");
    expect(js).toContain("createElement(\"iframe\")");
  });

  it("guards against re-mounting the same div", () => {
    const js = buildLoaderJs({ origin: "https://app" });
    expect(js).toContain('data-zc-mounted');
  });

  it("is parseable as JavaScript", () => {
    const js = buildLoaderJs({ origin: "https://app" });
    // Function constructor throws on syntax errors. Wrap in a no-op host so the
    // IIFE doesn't actually execute (no `document` in node).
    expect(() => new Function("window", "document", `var window={};var document={querySelectorAll:function(){return[]},addEventListener:function(){},readyState:"complete"};${js}`)).not.toThrow();
  });
});

describe("forms embed — resize helper", () => {
  it("sends form id + height to a fixed parent origin", () => {
    const js = buildEmbedResizeJs("form-123", "https://embedder.example.com");
    expect(js).toContain('"form-123"');
    expect(js).toContain('"https://embedder.example.com"');
    expect(js).toContain("zc-form-resize");
    expect(js).toContain("ResizeObserver");
  });
});
