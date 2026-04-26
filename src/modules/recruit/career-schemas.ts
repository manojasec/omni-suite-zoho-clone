import { z } from "zod";
import { EMPLOYMENT_TYPES } from "./schemas";

/** Convert a job title to a URL-safe slug. */
export function slugifyTitle(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

const SLUG_RE = /^[a-z0-9-]*$/;

/** Optional career-site slug. Empty string means "not yet published to career site". */
export const careerJobSlugSchema = z
  .string()
  .trim()
  .max(160)
  .regex(SLUG_RE, "Use lowercase letters, numbers, and dashes only")
  .optional()
  .or(z.literal(""));

const optional = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const applicationSubmissionSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  phone: optional(40),
  headline: optional(200),
  location: optional(160),
  linkedinUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  resumeUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  coverLetter: optional(5000),
  source: z.string().trim().max(60).default("career-site"),
});
export type ApplicationSubmissionInput = z.infer<typeof applicationSubmissionSchema>;

function formatMoney(amount: number, currency: string): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    const s = k % 1 === 0 ? `${k}` : k.toFixed(1);
    return `${currency === "USD" ? "$" : ""}${s}k`;
  }
  return `${currency === "USD" ? "$" : ""}${amount}`;
}

/** Pretty-print a salary range: "$80k–$120k USD", "Up to $X USD", "From $X USD", or fallback. */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string = "USD",
): string {
  const hasMin = typeof min === "number" && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === "number" && Number.isFinite(max) && max > 0;
  if (!hasMin && !hasMax) return "Not specified";
  if (hasMin && hasMax) {
    return `${formatMoney(min as number, currency)}–${formatMoney(max as number, currency)} ${currency}`;
  }
  if (hasMax) return `Up to ${formatMoney(max as number, currency)} ${currency}`;
  return `From ${formatMoney(min as number, currency)} ${currency}`;
}

const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Internship",
  TEMPORARY: "Temporary",
};

/** Human-readable label for a job employment type. */
export function formatEmploymentType(
  type: (typeof EMPLOYMENT_TYPES)[number] | string,
): string {
  return EMPLOYMENT_LABELS[type as (typeof EMPLOYMENT_TYPES)[number]] ?? type;
}
