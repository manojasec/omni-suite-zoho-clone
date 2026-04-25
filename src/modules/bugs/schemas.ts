import { z } from "zod";

const trimmedOptional = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim() || undefined);

export const ISSUE_TYPES = ["BUG", "FEATURE", "TASK", "IMPROVEMENT"] as const;
export const ISSUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const ISSUE_SEVERITIES = [
  "TRIVIAL",
  "MINOR",
  "MAJOR",
  "CRITICAL",
  "BLOCKER",
] as const;
export const ISSUE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
] as const;

export const issueProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Key must be 2-6 characters")
    .max(6, "Key must be 2-6 characters")
    .regex(/^[A-Z][A-Z0-9]+$/, "Key must start with a letter and contain only uppercase letters and digits"),
  description: trimmedOptional,
});
export type IssueProjectInput = z.infer<typeof issueProjectSchema>;

export const issueSchema = z.object({
  projectId: z.string().trim().min(1, "Project is required"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: trimmedOptional,
  type: z.enum(ISSUE_TYPES).default("BUG"),
  priority: z.enum(ISSUE_PRIORITIES).default("MEDIUM"),
  severity: z.enum(ISSUE_SEVERITIES).default("MINOR"),
  assigneeId: trimmedOptional,
  environment: trimmedOptional,
  stepsToReproduce: trimmedOptional,
  expected: trimmedOptional,
  actual: trimmedOptional,
  version: trimmedOptional,
  dueDate: trimmedOptional,
  tags: trimmedOptional,
});
export type IssueInput = z.infer<typeof issueSchema>;

export const issueUpdateSchema = issueSchema
  .omit({ projectId: true })
  .extend({
    status: z.enum(ISSUE_STATUSES).default("OPEN"),
  });
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;

export const issueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

export const issueAssignSchema = z.object({
  assigneeId: z.string().trim().optional().transform((v) => (v ?? "").trim() || null),
});

export const issueCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(5000),
});
export type IssueCommentInput = z.infer<typeof issueCommentSchema>;

/**
 * Normalises a comma/space separated tag string into a clean comma-separated
 * list. Returns `undefined` when nothing remains.
 */
export function normaliseTags(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of input.split(/[,\s]+/u)) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (t.length > 32) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    parts.push(t);
    if (parts.length >= 10) break;
  }
  return parts.length === 0 ? undefined : parts.join(",");
}

/**
 * Determines whether a status transition is allowed.
 * Workflow:
 *   OPEN ↔ IN_PROGRESS → RESOLVED → CLOSED
 *   CLOSED → REOPENED → IN_PROGRESS
 *   RESOLVED → REOPENED
 */
export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed: Record<string, string[]> = {
    OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    IN_PROGRESS: ["OPEN", "RESOLVED"],
    RESOLVED: ["CLOSED", "REOPENED"],
    CLOSED: ["REOPENED"],
    REOPENED: ["IN_PROGRESS", "RESOLVED"],
  };
  return allowed[from]?.includes(to) ?? false;
}
