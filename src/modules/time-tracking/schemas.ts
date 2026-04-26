import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""));

const isoDateTime = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date/time");

export const startTimerSchema = z
  .object({
    taskId: z.string().optional(),
    projectId: z.string().optional(),
    description: z.string().max(500).optional().default(""),
    billable: z
      .union([z.literal("on"), z.literal("true"), z.literal("")])
      .optional(),
  })
  .transform((v) => ({
    taskId: v.taskId && v.taskId !== "" ? v.taskId : undefined,
    projectId: v.projectId && v.projectId !== "" ? v.projectId : undefined,
    description: v.description?.trim() ?? "",
    billable: v.billable === "on" || v.billable === "true",
  }));

export const manualEntrySchema = z
  .object({
    taskId: z.string().optional(),
    projectId: z.string().optional(),
    description: z.string().max(500).optional().default(""),
    startedAt: isoDateTime,
    endedAt: isoDateTime,
    billable: z
      .union([z.literal("on"), z.literal("true"), z.literal("")])
      .optional(),
  })
  .superRefine((v, ctx) => {
    const start = new Date(v.startedAt).getTime();
    const end = new Date(v.endedAt).getTime();
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "End must be after start",
      });
    }
    if (end - start > 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endedAt"],
        message: "Entry cannot exceed 24 hours",
      });
    }
  })
  .transform((v) => ({
    taskId: v.taskId && v.taskId !== "" ? v.taskId : undefined,
    projectId: v.projectId && v.projectId !== "" ? v.projectId : undefined,
    description: v.description?.trim() ?? "",
    startedAt: new Date(v.startedAt),
    endedAt: new Date(v.endedAt),
    billable: v.billable === "on" || v.billable === "true",
  }));

export const updateEntrySchema = manualEntrySchema;

export const timesheetFilterSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
});

const SECONDS_PER_HOUR = 3600;

export function computeDurationSec(startedAt: Date, endedAt: Date | null): number {
  if (!endedAt) return 0;
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function toHours(sec: number): number {
  return Math.round((sec / SECONDS_PER_HOUR) * 100) / 100;
}

export function startOfDay(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isoDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type TimeEntryRow = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSec: number;
  billable: boolean;
};

export function summarizeEntries(entries: TimeEntryRow[]) {
  let totalSec = 0;
  let billableSec = 0;
  let runningCount = 0;
  for (const e of entries) {
    const dur = e.endedAt ? e.durationSec : 0;
    totalSec += dur;
    if (e.billable) billableSec += dur;
    if (!e.endedAt) runningCount++;
  }
  return {
    totalSec,
    billableSec,
    nonBillableSec: totalSec - billableSec,
    totalHours: toHours(totalSec),
    billableHours: toHours(billableSec),
    runningCount,
    count: entries.length,
  };
}

export function groupByDay(
  entries: Array<TimeEntryRow & { description?: string | null }>,
): Array<{ date: string; totalSec: number; entries: typeof entries }> {
  const buckets = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = isoDateKey(startOfDay(e.startedAt));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      totalSec: list.reduce(
        (s, e) => s + (e.endedAt ? e.durationSec : 0),
        0,
      ),
      entries: list.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
      ),
    }));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function toDateTimeLocal(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}
