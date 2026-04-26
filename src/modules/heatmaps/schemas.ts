import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const HEATMAP_SITE_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type HeatmapSiteStatus = (typeof HEATMAP_SITE_STATUSES)[number];

export const HEATMAP_EVENT_KINDS = ["CLICK", "MOVE", "SCROLL"] as const;
export type HeatmapEventKind = (typeof HEATMAP_EVENT_KINDS)[number];

export const SESSION_RECORDING_STATUSES = [
  "RECORDING",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type SessionRecordingStatus = (typeof SESSION_RECORDING_STATUSES)[number];

export const HEATMAP_SITE_STATUS_LABELS: Record<HeatmapSiteStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
};

export const HEATMAP_EVENT_KIND_LABELS: Record<HeatmapEventKind, string> = {
  CLICK: "Clicks",
  MOVE: "Mouse movement",
  SCROLL: "Scrolls",
};

export const SESSION_RECORDING_STATUS_LABELS: Record<
  SessionRecordingStatus,
  string
> = {
  RECORDING: "Recording",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const domainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export const heatmapSiteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .regex(domainRe, "Use a valid domain like example.com"),
  status: z.enum(HEATMAP_SITE_STATUSES).default("ACTIVE"),
  sampleRate: z.coerce.number().int().min(1).max(100).default(100),
});

export const heatmapPageSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .regex(/^\//, "Path must start with /"),
  label: optionalString(160),
});

export const sessionRecordingFilterSchema = z.object({
  status: z.enum(SESSION_RECORDING_STATUSES).optional(),
  siteId: z.string().trim().min(1).optional(),
});

/** Generate a 32-char tracker key (hex-friendly). Crypto-safe when available. */
export function generateTrackerKey(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(20);
    cryptoObj.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback (only used in non-crypto envs).
  let out = "";
  for (let i = 0; i < 40; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/** Normalize a URL or path into a stored canonical path. Strips host, query, hash. */
export function normalizePath(input: string): string {
  if (typeof input !== "string") return "/";
  const trimmed = input.trim();
  if (!trimmed) return "/";
  let path = trimmed;
  // Strip protocol + host.
  const protoIdx = path.indexOf("://");
  if (protoIdx !== -1) {
    const slashIdx = path.indexOf("/", protoIdx + 3);
    path = slashIdx === -1 ? "/" : path.slice(slashIdx);
  }
  // Strip query and hash.
  const qIdx = path.indexOf("?");
  if (qIdx !== -1) path = path.slice(0, qIdx);
  const hIdx = path.indexOf("#");
  if (hIdx !== -1) path = path.slice(0, hIdx);
  if (!path.startsWith("/")) path = "/" + path;
  // Collapse repeated slashes (except leading one).
  path = path.replace(/\/{2,}/g, "/");
  // Strip trailing slash unless it's just "/".
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.slice(0, 400);
}

/** Clamp a percentage to [0, 100] with 3 decimals. Non-finite → 0. */
export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 1000) / 1000;
}

export type GridCell = { x: number; y: number; count: number };

/**
 * Bucket events into an N×N grid (default 20). Returns a sparse list of cells
 * with at least one hit.
 */
export function bucketEvents(
  events: readonly { xPercent: number | { toNumber(): number }; yPercent: number | { toNumber(): number } }[],
  bins = 20,
): GridCell[] {
  if (!Number.isInteger(bins) || bins < 1 || bins > 200) bins = 20;
  const buckets = new Map<string, GridCell>();
  for (const e of events) {
    const xRaw = typeof e.xPercent === "number" ? e.xPercent : e.xPercent.toNumber();
    const yRaw = typeof e.yPercent === "number" ? e.yPercent : e.yPercent.toNumber();
    const x = clampPercent(xRaw);
    const y = clampPercent(yRaw);
    // Map [0..100] → bin index [0..bins-1].
    const xi = Math.min(bins - 1, Math.floor((x / 100) * bins));
    const yi = Math.min(bins - 1, Math.floor((y / 100) * bins));
    const k = `${xi},${yi}`;
    const existing = buckets.get(k);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(k, { x: xi, y: yi, count: 1 });
    }
  }
  return Array.from(buckets.values());
}

export type HeatmapSummary = {
  total: number;
  byKind: Record<HeatmapEventKind, number>;
};

export function summarizeHeatmapEvents(
  events: readonly { kind: HeatmapEventKind }[],
): HeatmapSummary {
  const byKind: Record<HeatmapEventKind, number> = {
    CLICK: 0,
    MOVE: 0,
    SCROLL: 0,
  };
  for (const e of events) byKind[e.kind] += 1;
  return { total: events.length, byKind };
}

/** Format a millisecond duration as "1m 23s" / "12s" / "0s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export const SESSION_RECORDING_TRANSITIONS: Record<
  SessionRecordingStatus,
  readonly SessionRecordingStatus[]
> = {
  RECORDING: ["COMPLETED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionRecording(
  from: SessionRecordingStatus,
  to: SessionRecordingStatus,
): boolean {
  return SESSION_RECORDING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function summarizeSitesByStatus(
  sites: readonly { status: HeatmapSiteStatus }[],
): Record<HeatmapSiteStatus, number> {
  const out: Record<HeatmapSiteStatus, number> = { ACTIVE: 0, PAUSED: 0 };
  for (const s of sites) out[s.status] += 1;
  return out;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString().slice(0, 16).replace("T", " ");
}
