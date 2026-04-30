import { z } from "zod";

export const GOAL_STATUSES = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const KEY_RESULT_UNITS = [
  "PERCENT",
  "NUMBER",
  "CURRENCY",
  "BOOLEAN",
] as const;
export type KeyResultUnit = (typeof KEY_RESULT_UNITS)[number];

const STATUS_LABELS: Record<GoalStatus, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<GoalStatus, string> = {
  ON_TRACK: "bg-emerald-100 text-emerald-800",
  AT_RISK: "bg-amber-100 text-amber-800",
  OFF_TRACK: "bg-rose-100 text-rose-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  ARCHIVED: "bg-zinc-200 text-zinc-700",
};

export function formatGoalStatus(s: GoalStatus | string): string {
  return STATUS_LABELS[s as GoalStatus] ?? String(s);
}

export function goalStatusColor(s: GoalStatus): string {
  return STATUS_COLORS[s];
}

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const goalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optional(2_000),
  parentId: optional(40),
  ownerId: optional(40),
  status: z.enum(GOAL_STATUSES).default("ON_TRACK"),
  startDate: optional(40),
  dueDate: optional(40),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const keyResultSchema = z.object({
  title: z.string().trim().min(1).max(200),
  unit: z.enum(KEY_RESULT_UNITS).default("PERCENT"),
  startValue: z.coerce.number().min(0).max(1_000_000_000),
  targetValue: z.coerce.number().min(0).max(1_000_000_000),
  currentValue: z.coerce.number().min(0).max(1_000_000_000),
});
export type KeyResultInput = z.infer<typeof keyResultSchema>;

/**
 * Compute progress for a single key result as a 0-100 percentage.
 * - PERCENT/NUMBER/CURRENCY: linear interpolation between start and target.
 * - BOOLEAN: 100 when current >= target, else 0.
 */
export function keyResultProgress(kr: {
  unit: KeyResultUnit;
  startValue: number;
  targetValue: number;
  currentValue: number;
}): number {
  if (kr.unit === "BOOLEAN") {
    return kr.currentValue >= kr.targetValue ? 100 : 0;
  }
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const ratio = (kr.currentValue - kr.startValue) / span;
  if (!Number.isFinite(ratio)) return 0;
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 10000) / 100;
}

/** Average progress across key results (0 when none). */
export function goalProgress(
  keyResults: Array<{
    unit: KeyResultUnit;
    startValue: number;
    targetValue: number;
    currentValue: number;
  }>,
): number {
  if (keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc, kr) => acc + keyResultProgress(kr), 0);
  return Math.round((sum / keyResults.length) * 100) / 100;
}
