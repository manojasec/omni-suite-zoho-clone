import { describe, expect, it } from "vitest";
import {
  HEATMAP_EVENT_KINDS,
  HEATMAP_SITE_STATUSES,
  SESSION_RECORDING_STATUSES,
  SESSION_RECORDING_TRANSITIONS,
  bucketEvents,
  canTransitionRecording,
  clampPercent,
  formatDate,
  formatDuration,
  generateTrackerKey,
  heatmapPageSchema,
  heatmapSiteSchema,
  normalizePath,
  summarizeHeatmapEvents,
  summarizeSitesByStatus,
} from "@/modules/heatmaps/schemas";

describe("heatmap constants", () => {
  it("exposes expected enum values", () => {
    expect(HEATMAP_SITE_STATUSES).toEqual(["ACTIVE", "PAUSED"]);
    expect(HEATMAP_EVENT_KINDS).toEqual(["CLICK", "MOVE", "SCROLL"]);
    expect(SESSION_RECORDING_STATUSES).toEqual([
      "RECORDING",
      "COMPLETED",
      "ARCHIVED",
    ]);
  });
});

describe("heatmapSiteSchema", () => {
  it("parses a valid site with defaults", () => {
    const r = heatmapSiteSchema.parse({
      name: " Marketing ",
      domain: "Example.COM",
    });
    expect(r.name).toBe("Marketing");
    expect(r.domain).toBe("example.com");
    expect(r.status).toBe("ACTIVE");
    expect(r.sampleRate).toBe(100);
  });

  it("coerces sampleRate from string and validates range", () => {
    expect(heatmapSiteSchema.parse({
      name: "x",
      domain: "ex.com",
      sampleRate: "50",
    }).sampleRate).toBe(50);

    expect(() =>
      heatmapSiteSchema.parse({ name: "x", domain: "ex.com", sampleRate: 0 }),
    ).toThrow();
    expect(() =>
      heatmapSiteSchema.parse({ name: "x", domain: "ex.com", sampleRate: 101 }),
    ).toThrow();
  });

  it("rejects malformed domains", () => {
    expect(() =>
      heatmapSiteSchema.parse({ name: "x", domain: "not_a_domain" }),
    ).toThrow();
    expect(() =>
      heatmapSiteSchema.parse({ name: "x", domain: "" }),
    ).toThrow();
  });

  it("requires name", () => {
    expect(() => heatmapSiteSchema.parse({ name: "", domain: "ex.com" })).toThrow();
  });
});

describe("heatmapPageSchema", () => {
  it("requires leading slash", () => {
    expect(() => heatmapPageSchema.parse({ path: "pricing" })).toThrow();
    expect(heatmapPageSchema.parse({ path: "/pricing" }).path).toBe("/pricing");
  });

  it("treats blank label as undefined", () => {
    const r = heatmapPageSchema.parse({ path: "/x", label: "" });
    expect(r.label).toBeUndefined();
  });

  it("trims label", () => {
    const r = heatmapPageSchema.parse({ path: "/x", label: "  Hello  " });
    expect(r.label).toBe("Hello");
  });
});

describe("generateTrackerKey", () => {
  it("returns a 40-char hex string", () => {
    const k = generateTrackerKey();
    expect(k).toMatch(/^[0-9a-f]{40}$/);
  });

  it("returns different values across calls", () => {
    const a = generateTrackerKey();
    const b = generateTrackerKey();
    expect(a).not.toBe(b);
  });
});

describe("normalizePath", () => {
  it("strips host, query, and hash", () => {
    expect(normalizePath("https://example.com/foo?x=1#y")).toBe("/foo");
  });
  it("ensures leading slash", () => {
    expect(normalizePath("foo/bar")).toBe("/foo/bar");
  });
  it("collapses double slashes", () => {
    expect(normalizePath("/foo//bar")).toBe("/foo/bar");
  });
  it("removes trailing slash except root", () => {
    expect(normalizePath("/foo/")).toBe("/foo");
    expect(normalizePath("/")).toBe("/");
  });
  it("handles empty input", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("   ")).toBe("/");
  });
});

describe("clampPercent", () => {
  it("clamps to 0..100", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(50.5)).toBe(50.5);
  });
  it("returns 0 for non-finite", () => {
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(0);
  });
});

describe("bucketEvents", () => {
  it("returns empty for no events", () => {
    expect(bucketEvents([])).toEqual([]);
  });

  it("buckets events into a 20×20 grid by default", () => {
    const events = [
      { xPercent: 0, yPercent: 0 },
      { xPercent: 4, yPercent: 4 },
      { xPercent: 99, yPercent: 99 },
    ];
    const cells = bucketEvents(events);
    // First two land in cell (0,0); third in (19,19).
    const sorted = cells.sort((a, b) => a.x - b.x);
    expect(sorted).toEqual([
      { x: 0, y: 0, count: 2 },
      { x: 19, y: 19, count: 1 },
    ]);
  });

  it("supports decimal-like inputs via toNumber()", () => {
    const cells = bucketEvents([
      {
        xPercent: { toNumber: () => 50 },
        yPercent: { toNumber: () => 50 },
      },
    ]);
    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(1);
  });

  it("ignores out-of-range values via clamping", () => {
    const cells = bucketEvents([{ xPercent: 200, yPercent: -50 }]);
    expect(cells).toEqual([{ x: 19, y: 0, count: 1 }]);
  });

  it("falls back to default bins on invalid input", () => {
    const cells = bucketEvents([{ xPercent: 0, yPercent: 0 }], 0);
    expect(cells[0]).toEqual({ x: 0, y: 0, count: 1 });
  });
});

describe("summarizeHeatmapEvents", () => {
  it("counts events by kind", () => {
    const r = summarizeHeatmapEvents([
      { kind: "CLICK" },
      { kind: "CLICK" },
      { kind: "MOVE" },
    ]);
    expect(r).toEqual({
      total: 3,
      byKind: { CLICK: 2, MOVE: 1, SCROLL: 0 },
    });
  });
});

describe("formatDuration", () => {
  it("formats seconds-only", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(12_300)).toBe("12s");
  });
  it("formats minutes + seconds", () => {
    expect(formatDuration(83_000)).toBe("1m 23s");
  });
  it("handles invalid input", () => {
    expect(formatDuration(-1)).toBe("0s");
    expect(formatDuration(Number.NaN)).toBe("0s");
  });
});

describe("recording transitions", () => {
  it("allows the documented transitions only", () => {
    expect(canTransitionRecording("RECORDING", "COMPLETED")).toBe(true);
    expect(canTransitionRecording("COMPLETED", "ARCHIVED")).toBe(true);
    expect(canTransitionRecording("ARCHIVED", "RECORDING")).toBe(false);
    expect(canTransitionRecording("RECORDING", "ARCHIVED")).toBe(false);
    expect(canTransitionRecording("COMPLETED", "RECORDING")).toBe(false);
  });

  it("has a terminal ARCHIVED state", () => {
    expect(SESSION_RECORDING_TRANSITIONS.ARCHIVED).toEqual([]);
  });
});

describe("summarizeSitesByStatus", () => {
  it("counts sites by status", () => {
    const r = summarizeSitesByStatus([
      { status: "ACTIVE" },
      { status: "ACTIVE" },
      { status: "PAUSED" },
    ]);
    expect(r).toEqual({ ACTIVE: 2, PAUSED: 1 });
  });
});

describe("formatDate", () => {
  it("formats a date as YYYY-MM-DD HH:MM (UTC ISO slice)", () => {
    const d = new Date(Date.UTC(2024, 0, 15, 9, 30));
    expect(formatDate(d)).toBe("2024-01-15 09:30");
  });
  it("returns empty for null/undefined/invalid", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate(new Date("not a date"))).toBe("");
  });
});
