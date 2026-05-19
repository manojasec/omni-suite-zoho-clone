import { describe, it, expect } from "vitest";
import { GET as pixelGet } from "@/app/api/heatmap/pixel.js/route";

describe("heatmap pixel.js endpoint", () => {
  it("returns JS body containing the tracker key and origin", async () => {
    const res = await pixelGet(new Request("https://x.test/api/heatmap/pixel.js?key=abc-123"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
    const text = await res.text();
    expect(text).toContain('"abc-123"');
    expect(text).toContain('"https://x.test"');
    expect(text).toContain("/api/heatmap/track");
    expect(text).toContain("__omniHeatLoaded");
    expect(text).toContain("sendBeacon");
  });

  it("strips unsafe characters from the key", async () => {
    const res = await pixelGet(new Request("https://x/api/heatmap/pixel.js?key=ab%3Cb%3Ecd"));
    const text = await res.text();
    // Angle brackets stripped from the *key* — the rendered value is "abbcd".
    expect(text).toContain('"abbcd"');
    expect(text).not.toContain('"ab<b>cd"');
  });
});
