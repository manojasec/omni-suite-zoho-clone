import { describe, it, expect } from "vitest";
import {
  buildEmbedIframe,
  buildEmbedUrl,
  createShareToken,
  verifyShareToken,
} from "@/modules/dashboards/share";

const SECRET = "share-secret-1";

describe("dashboard share tokens", () => {
  it("roundtrips a token with claims", () => {
    const tok = createShareToken({ workspaceId: "ws1", dashboardId: "d1", scope: "view" }, SECRET);
    const p = verifyShareToken(tok, SECRET);
    expect(p?.workspaceId).toBe("ws1");
    expect(p?.dashboardId).toBe("d1");
    expect(p?.scope).toBe("view");
  });

  it("rejects wrong secret", () => {
    const tok = createShareToken({ workspaceId: "ws1", dashboardId: "d1" }, SECRET);
    expect(verifyShareToken(tok, "other")).toBeNull();
  });

  it("rejects tampered payload", () => {
    const tok = createShareToken({ workspaceId: "ws1", dashboardId: "d1" }, SECRET);
    const [body, sig] = tok.split(".") as [string, string];
    // swap a character in the body
    const flipped = (body[0] === "A" ? "B" : "A") + body.slice(1);
    expect(verifyShareToken(`${flipped}.${sig}`, SECRET)).toBeNull();
  });

  it("honors expiry", () => {
    const t = createShareToken({ workspaceId: "ws", dashboardId: "d", ttlMs: 1000, now: 1_000_000 }, SECRET);
    expect(verifyShareToken(t, SECRET, { now: 1_000_500 })?.dashboardId).toBe("d");
    expect(verifyShareToken(t, SECRET, { now: 1_001_500 })).toBeNull();
  });

  it("enforces expected workspace/dashboard scope", () => {
    const t = createShareToken({ workspaceId: "ws1", dashboardId: "d1" }, SECRET);
    expect(verifyShareToken(t, SECRET, { expectedDashboardId: "d1" })?.dashboardId).toBe("d1");
    expect(verifyShareToken(t, SECRET, { expectedDashboardId: "d2" })).toBeNull();
    expect(verifyShareToken(t, SECRET, { expectedWorkspaceId: "other" })).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyShareToken("", SECRET)).toBeNull();
    expect(verifyShareToken("only-one-part", SECRET)).toBeNull();
    expect(verifyShareToken("a.b.c", SECRET)).toBeNull();
  });

  it("createShareToken requires a secret", () => {
    expect(() => createShareToken({ workspaceId: "w", dashboardId: "d" }, "")).toThrow();
  });

  it("buildEmbedUrl appends a token query param", () => {
    const url = buildEmbedUrl("https://app.example.com/", "d1", "tok-xyz");
    expect(url).toBe("https://app.example.com/embed/dashboards/d1?token=tok-xyz");
  });

  it("buildEmbedIframe escapes the URL and title", () => {
    const html = buildEmbedIframe("https://app/x?a=1", { width: 800, height: 400, title: 'My "board"' });
    expect(html).toContain('src="https://app/x?a=1"');
    expect(html).toContain('width="800"');
    expect(html).toContain('title="My &quot;board&quot;"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
  });
});
