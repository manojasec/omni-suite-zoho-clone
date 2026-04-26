import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

const optionalIsoDate = z.preprocess((v) => {
  if (v === "" || v == null) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v);
  return v;
}, z.date().optional());

export const ASSET_STATUSES = ["IN_USE", "IN_STORAGE", "RETIRED", "LOST"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const CHANGE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELED",
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_RISKS = ["LOW", "MEDIUM", "HIGH"] as const;
export type ChangeRisk = (typeof CHANGE_RISKS)[number];

export const PROBLEM_STATUSES = [
  "OPEN",
  "INVESTIGATING",
  "KNOWN_ERROR",
  "RESOLVED",
  "CLOSED",
] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  IN_USE: "In use",
  IN_STORAGE: "In storage",
  RETIRED: "Retired",
  LOST: "Lost / Stolen",
};

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELED: "Canceled",
};

export const CHANGE_RISK_LABELS: Record<ChangeRisk, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const PROBLEM_STATUS_LABELS: Record<ProblemStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  KNOWN_ERROR: "Known error",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const optionalCost = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().min(0).max(100_000_000).optional(),
);

const optionalEmployeeId = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().min(1).optional(),
);

export const assetSchema = z.object({
  tag: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60).default("general"),
  status: z.enum(ASSET_STATUSES).default("IN_USE"),
  serial: optionalString(120),
  vendor: optionalString(120),
  location: optionalString(160),
  assignedToEmployeeId: optionalEmployeeId,
  purchaseDate: optionalIsoDate,
  cost: optionalCost,
  notes: optionalString(1000),
});

export const assignAssetSchema = z.object({
  assignedToEmployeeId: optionalEmployeeId,
});

export const changeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalString(8000),
  risk: z.enum(CHANGE_RISKS).default("MEDIUM"),
  assetId: optionalEmployeeId,
  scheduledAt: optionalIsoDate,
  rollbackPlan: optionalString(2000),
  notes: optionalString(2000),
});

export const problemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalString(8000),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  assetId: optionalEmployeeId,
  workaround: optionalString(2000),
  rootCause: optionalString(2000),
});

export const resolveProblemSchema = z.object({
  resolution: z.string().trim().min(1).max(2000),
});

/**
 * Allowed change-status transitions.
 * DRAFT → SUBMITTED → (APPROVED → IN_PROGRESS → COMPLETED) | REJECTED.
 * Anything not yet COMPLETED can be CANCELED.
 */
export const CHANGE_TRANSITIONS: Record<ChangeStatus, readonly ChangeStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELED"],
  SUBMITTED: ["APPROVED", "REJECTED", "CANCELED"],
  APPROVED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELED: [],
};

export function canTransitionChange(
  from: ChangeStatus,
  to: ChangeStatus,
): boolean {
  return CHANGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Allowed problem-status transitions.
 */
export const PROBLEM_TRANSITIONS: Record<ProblemStatus, readonly ProblemStatus[]> = {
  OPEN: ["INVESTIGATING", "KNOWN_ERROR", "RESOLVED", "CLOSED"],
  INVESTIGATING: ["KNOWN_ERROR", "RESOLVED", "CLOSED"],
  KNOWN_ERROR: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
};

export function canTransitionProblem(
  from: ProblemStatus,
  to: ProblemStatus,
): boolean {
  return PROBLEM_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Format a Date as YYYY-MM-DD; empty string for null/invalid. */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString().slice(0, 10);
}

/** Format an asset's identifier for display. */
export function formatAssetLabel(asset: { tag: string; name: string }): string {
  return `[${asset.tag}] ${asset.name}`;
}

type CountInput = {
  status: AssetStatus | ChangeStatus | ProblemStatus;
};

export function summarizeByStatus<T extends string>(
  rows: { status: T }[],
  statuses: readonly T[],
): Record<T, number> {
  const out = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<T, number>;
  for (const r of rows) {
    if (r.status in out) out[r.status]++;
  }
  return out;
}

/**
 * Compute risk weight (0..3) for sorting / dashboards.
 */
export function changeRiskWeight(risk: ChangeRisk): number {
  return risk === "HIGH" ? 3 : risk === "MEDIUM" ? 2 : 1;
}

export function priorityWeight(p: Priority): number {
  return p === "URGENT" ? 4 : p === "HIGH" ? 3 : p === "MEDIUM" ? 2 : 1;
}

export type _Compat = CountInput;
