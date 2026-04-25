import { z } from "zod";

export const WORKFLOW_TRIGGERS = ["MANUAL", "CONTACT_CREATED"] as const;
export const WORKFLOW_STATUSES = ["DRAFT", "ACTIVE", "PAUSED"] as const;
export const WORKFLOW_STEP_TYPES = ["WAIT_DAYS", "SEND_EMAIL", "ADD_TAG"] as const;
export const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "EXITED"] as const;

const opt = (s: z.ZodTypeAny) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s.optional());

export const workflowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: opt(z.string().max(2000)),
  trigger: z.enum(WORKFLOW_TRIGGERS).default("MANUAL"),
});

export const workflowStepSchema = z
  .object({
    type: z.enum(WORKFLOW_STEP_TYPES),
    waitDays: opt(z.coerce.number().int().min(1).max(365)),
    emailSubject: opt(z.string().max(200)),
    emailHtml: opt(z.string().max(50_000)),
    tag: opt(z.string().max(40)),
  })
  .superRefine((v, ctx) => {
    if (v.type === "WAIT_DAYS" && (v.waitDays === undefined || v.waitDays < 1)) {
      ctx.addIssue({ code: "custom", message: "waitDays is required (1-365)", path: ["waitDays"] });
    }
    if (v.type === "SEND_EMAIL") {
      if (!v.emailSubject) {
        ctx.addIssue({ code: "custom", message: "emailSubject is required", path: ["emailSubject"] });
      }
      if (!v.emailHtml) {
        ctx.addIssue({ code: "custom", message: "emailHtml is required", path: ["emailHtml"] });
      }
    }
    if (v.type === "ADD_TAG" && !v.tag) {
      ctx.addIssue({ code: "custom", message: "tag is required", path: ["tag"] });
    }
  });

export const enrollContactSchema = z.object({
  contactId: z.string().min(1),
});

export const updateWorkflowStatusSchema = z.object({
  status: z.enum(WORKFLOW_STATUSES),
});

export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

/** Compute a step's next-run timestamp given the current moment. */
export function computeNextRunAt(stepType: WorkflowStepType, waitDays: number | null | undefined, now = new Date()): Date {
  if (stepType === "WAIT_DAYS" && waitDays && waitDays > 0) {
    return new Date(now.getTime() + waitDays * 24 * 60 * 60 * 1000);
  }
  return now;
}

/** Append a tag to the existing JSON-array tag list. Returns null if unchanged. */
export function addTagToList(existing: unknown, tag: string): string[] | null {
  const list = Array.isArray(existing) ? existing.filter((t): t is string => typeof t === "string") : [];
  const norm = tag.trim().toLowerCase();
  if (!norm) return null;
  if (list.map((t) => t.toLowerCase()).includes(norm)) return null;
  return [...list, norm];
}
