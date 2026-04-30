import { z } from "zod";

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_RESOURCES = [
  "expense",
  "purchaseOrder",
  "invoice",
  "quote",
  "leaveRequest",
] as const;
export type ApprovalResource = (typeof APPROVAL_RESOURCES)[number];

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-zinc-100 text-zinc-700",
};

export function formatApprovalStatus(s: ApprovalStatus | string): string {
  return STATUS_LABELS[s as ApprovalStatus] ?? String(s);
}

export function approvalStatusColor(s: ApprovalStatus): string {
  return STATUS_COLORS[s];
}

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const approvalPolicySchema = z.object({
  name: z.string().trim().min(1).max(120),
  resource: z.enum(APPROVAL_RESOURCES),
  threshold: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .pipe(z.number().min(0).max(1_000_000_000).optional()),
  approverIds: z
    .array(z.string().min(1).max(40))
    .min(1, "At least one approver"),
  isActive: z.coerce.boolean().default(true),
});
export type ApprovalPolicyInput = z.infer<typeof approvalPolicySchema>;

export const approvalRequestSchema = z.object({
  resource: z.enum(APPROVAL_RESOURCES),
  resourceId: z.string().min(1).max(40),
  amount: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? Number(v) : undefined))
    .pipe(z.number().min(0).max(1_000_000_000).optional()),
  reason: optional(2_000),
});
export type ApprovalRequestInput = z.infer<typeof approvalRequestSchema>;

/**
 * Decide whether a policy applies to a given amount.
 * - threshold null/undefined → policy always applies.
 * - amount >= threshold → applies; below → bypass.
 */
export function policyApplies(input: {
  threshold: number | null;
  amount: number | null;
}): boolean {
  if (input.threshold == null) return true;
  if (input.amount == null) return false;
  return input.amount >= input.threshold;
}

export function isApprover(approverIds: string[], userId: string): boolean {
  return approverIds.includes(userId);
}

/** Encode/decode the approver list stored as a comma-separated string. */
export function encodeApprovers(ids: string[]): string {
  return [...new Set(ids.filter(Boolean))].join(",");
}

export function decodeApprovers(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}
