import { z } from "zod";

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "bg-zinc-400",
  IN_PROGRESS: "bg-sky-500",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-emerald-500",
  CANCELLED: "bg-zinc-300",
};

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""));

export const ganttTaskSchema = z
  .object({
    startAt: isoDate.optional().default(""),
    endAt: isoDate.optional().default(""),
    progress: z.coerce.number().int().min(0).max(100).optional().default(0),
  })
  .superRefine((v, ctx) => {
    if (v.startAt && v.endAt && v.startAt > v.endAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End must be on or after start",
      });
    }
  })
  .transform((v) => ({
    startAt: v.startAt ? v.startAt : undefined,
    endAt: v.endAt ? v.endAt : undefined,
    progress: v.progress ?? 0,
  }));

export const ganttDependencySchema = z
  .object({
    predecessorId: z.string().min(1, "Predecessor required"),
    successorId: z.string().min(1, "Successor required"),
  })
  .superRefine((v, ctx) => {
    if (v.predecessorId === v.successorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["predecessorId"],
        message: "A task cannot depend on itself",
      });
    }
  });

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date | string): Date {
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function diffDays(a: Date | string, b: Date | string): number {
  const start = startOfDay(a).getTime();
  const end = startOfDay(b).getTime();
  return Math.round((end - start) / DAY_MS);
}

export function addDays(d: Date | string, n: number): Date {
  const date = startOfDay(d);
  date.setDate(date.getDate() + n);
  return date;
}

export type DateRange = { min: Date; max: Date; days: number };

export function computeRange(
  tasks: Array<{ startAt: Date | null; endAt: Date | null }>,
  fallbackDays = 30,
): DateRange | null {
  const starts = tasks
    .map((t) => t.startAt)
    .filter((d): d is Date => Boolean(d))
    .map((d) => startOfDay(d).getTime());
  const ends = tasks
    .map((t) => t.endAt)
    .filter((d): d is Date => Boolean(d))
    .map((d) => startOfDay(d).getTime());
  if (starts.length === 0 && ends.length === 0) return null;
  const minMs = Math.min(...(starts.length ? starts : ends));
  const maxMs = Math.max(...(ends.length ? ends : starts));
  const min = new Date(minMs);
  let max = new Date(maxMs);
  if (diffDays(min, max) < 1) {
    max = addDays(min, fallbackDays);
  }
  return { min, max, days: diffDays(min, max) + 1 };
}

export type GanttBar = {
  offsetDays: number;
  spanDays: number;
  scheduled: boolean;
};

export function computeBar(
  task: { startAt: Date | null; endAt: Date | null },
  range: DateRange,
): GanttBar | null {
  if (!task.startAt || !task.endAt) return null;
  const offsetDays = Math.max(0, diffDays(range.min, task.startAt));
  const span = Math.max(1, diffDays(task.startAt, task.endAt) + 1);
  const visible = Math.min(span, range.days - offsetDays);
  if (visible <= 0) return null;
  return { offsetDays, spanDays: visible, scheduled: true };
}

/**
 * Detect cycles when adding a dependency predecessor → successor.
 * Returns true if adding it would create a cycle (i.e., predecessor is
 * already reachable from successor through existing edges).
 */
export function wouldCreateCycle(
  edges: Array<{ predecessorId: string; successorId: string }>,
  predecessorId: string,
  successorId: string,
): boolean {
  if (predecessorId === successorId) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.predecessorId)) adj.set(e.predecessorId, []);
    adj.get(e.predecessorId)!.push(e.successorId);
  }
  const stack = [successorId];
  const seen = new Set<string>();
  while (stack.length) {
    const node = stack.pop()!;
    if (node === predecessorId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    const nexts = adj.get(node);
    if (nexts) stack.push(...nexts);
  }
  return false;
}

export function summarizeGantt(
  tasks: Array<{ status: string; startAt: Date | null; endAt: Date | null }>,
) {
  const total = tasks.length;
  let scheduled = 0;
  let unscheduled = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.startAt && t.endAt) scheduled++;
    else unscheduled++;
    if (t.status === "DONE") done++;
  }
  return { total, scheduled, unscheduled, done };
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString();
}

export function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
