import { describe, it, expect } from "vitest";

/**
 * The widget endpoint is a server route module — instead of importing it
 * (which would pull in next/server) we replicate a thin shape test by
 * fetching from the route's source and asserting on output structure.
 *
 * We unit-test the route by invoking its `GET` directly with a synthetic
 * Request. This avoids needing a running Next.js server.
 */
import { GET } from "@/app/api/chat/widget.js/route";

describe("chat widget.js endpoint", () => {
  it("returns JS content-type and contains the slug + origin", async () => {
    const res = await GET(new Request("https://app.example.com/api/chat/widget.js?slug=acme&color=%23ff0000"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const text = await res.text();
    expect(text).toContain('"acme"');
    expect(text).toContain('"https://app.example.com"');
    expect(text).toContain("__omniChatLoaded");
    expect(text).toContain("/chat/embed/");
  });

  it("ignores invalid color and falls back to default", async () => {
    const res = await GET(new Request("https://x/api/chat/widget.js?slug=x&color=javascript:alert(1)"));
    const text = await res.text();
    expect(text).not.toContain("javascript:alert");
    expect(text).toContain("#0F172A");
  });

  it("strips unsafe characters from slug", async () => {
    const res = await GET(new Request("https://x/api/chat/widget.js?slug=ac%3Cb%3Ed"));
    const text = await res.text();
    // Angle brackets stripped; alnum preserved.
    expect(text).toContain('"acbd"');
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
  });
});
