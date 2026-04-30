import { describe, expect, it } from "vitest";
import {
  buildPortalUrl,
  formatPortalStatus,
  generatePortalToken,
  portalAccessSchema,
  portalLinkStatus,
  portalStatusColor,
} from "@/modules/portal/schemas";

describe("portal/schemas", () => {
  it("generates a URL-safe token of reasonable length", () => {
    const t = generatePortalToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t.length).toBeLessThanOrEqual(64);
  });

  it("generates unique tokens across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(generatePortalToken());
    expect(seen.size).toBe(50);
  });

  it("treats a revoked link as revoked even if not expired", () => {
    expect(
      portalLinkStatus({
        revokedAt: new Date("2026-01-01"),
        expiresAt: null,
      }),
    ).toBe("revoked");
  });

  it("treats a past expiry as expired", () => {
    expect(
      portalLinkStatus({
        revokedAt: null,
        expiresAt: new Date("2020-01-01"),
        now: new Date("2026-01-01"),
      }),
    ).toBe("expired");
  });

  it("treats a future expiry as active", () => {
    expect(
      portalLinkStatus({
        revokedAt: null,
        expiresAt: new Date("2099-01-01"),
        now: new Date("2026-01-01"),
      }),
    ).toBe("active");
  });

  it("treats no expiry as active", () => {
    expect(
      portalLinkStatus({ revokedAt: null, expiresAt: null }),
    ).toBe("active");
  });

  it("formats statuses with title-case labels", () => {
    expect(formatPortalStatus("active")).toBe("Active");
    expect(formatPortalStatus("expired")).toBe("Expired");
    expect(formatPortalStatus("revoked")).toBe("Revoked");
  });

  it("returns distinct status colors", () => {
    const colors = new Set([
      portalStatusColor("active"),
      portalStatusColor("expired"),
      portalStatusColor("revoked"),
    ]);
    expect(colors.size).toBe(3);
  });

  it("normalises empty expiresAt to undefined", () => {
    const parsed = portalAccessSchema.parse({ label: "x", expiresAt: "" });
    expect(parsed.expiresAt).toBeUndefined();
  });

  it("rejects label longer than 120 chars", () => {
    const result = portalAccessSchema.safeParse({
      label: "x".repeat(121),
      expiresAt: "",
    });
    expect(result.success).toBe(false);
  });

  it("builds a portal URL stripping trailing slashes", () => {
    expect(buildPortalUrl("https://app.example.com/", "tok123")).toBe(
      "https://app.example.com/portal/tok123",
    );
    expect(buildPortalUrl("https://app.example.com", "tok123")).toBe(
      "https://app.example.com/portal/tok123",
    );
  });
});
