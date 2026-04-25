import { z } from "zod";

export const JOB_STATUSES = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED"] as const;
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMPORARY"] as const;
export const CANDIDATE_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export const APPLICATION_STAGES = ["APPLIED", "SCREEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;
export const INTERVIEW_KINDS = ["PHONE", "VIDEO", "ONSITE", "TECHNICAL", "PANEL"] as const;
export const INTERVIEW_OUTCOMES = ["PENDING", "PASS", "FAIL", "NO_SHOW"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const jobOpeningSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    department: optionalText(80),
    location: optionalText(120),
    remote: z.coerce.boolean().default(false),
    employment: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
    status: z.enum(JOB_STATUSES).default("DRAFT"),
    description: optionalText(8000),
    salaryMin: z.coerce.number().nonnegative().max(99_999_999).optional().or(z.literal("").transform(() => undefined)),
    salaryMax: z.coerce.number().nonnegative().max(99_999_999).optional().or(z.literal("").transform(() => undefined)),
    currency: z.string().trim().regex(/^[A-Z]{3}$/, "ISO 4217 code").default("USD"),
    openings: z.coerce.number().int().min(1).max(999).default(1),
  })
  .superRefine((j, ctx) => {
    if (j.salaryMin !== undefined && j.salaryMax !== undefined && j.salaryMin > j.salaryMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Min salary cannot exceed max", path: ["salaryMin"] });
    }
  });
export type JobOpeningInput = z.infer<typeof jobOpeningSchema>;

export const candidateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: optionalText(40),
  headline: optionalText(160),
  location: optionalText(120),
  linkedinUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  resumeUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  source: optionalText(60),
  notes: optionalText(4000),
});
export type CandidateInput = z.infer<typeof candidateSchema>;

export const applicationCreateSchema = z.object({
  jobId: z.string().trim().min(1, "Job required"),
  candidateId: z.string().trim().min(1, "Candidate required"),
  stage: z.enum(APPLICATION_STAGES).default("APPLIED"),
  rating: z.coerce.number().int().min(1).max(5).optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText(4000),
});

export const applicationUpdateSchema = z.object({
  stage: z.enum(APPLICATION_STAGES),
  rating: z.coerce.number().int().min(1).max(5).optional().or(z.literal("").transform(() => undefined)),
  notes: optionalText(4000),
  rejectedReason: optionalText(500),
});

export const interviewSchema = z.object({
  kind: z.enum(INTERVIEW_KINDS).default("VIDEO"),
  scheduledAt: z.coerce.date(),
  durationMins: z.coerce.number().int().min(5).max(480).default(45),
  location: optionalText(200),
  interviewer: optionalText(120),
  outcome: z.enum(INTERVIEW_OUTCOMES).default("PENDING"),
  feedback: optionalText(4000),
});
export type InterviewInput = z.infer<typeof interviewSchema>;

/** Pipeline funnel — buckets candidates by stage. */
export function pipelineCounts(applications: { stage: (typeof APPLICATION_STAGES)[number] }[]) {
  const counts: Record<(typeof APPLICATION_STAGES)[number], number> = {
    APPLIED: 0, SCREEN: 0, INTERVIEW: 0, OFFER: 0, HIRED: 0, REJECTED: 0, WITHDRAWN: 0,
  };
  for (const a of applications) counts[a.stage] += 1;
  return counts;
}

/** Whether moving from one stage to another is logically allowed. */
export function isValidStageTransition(
  from: (typeof APPLICATION_STAGES)[number],
  to: (typeof APPLICATION_STAGES)[number],
): boolean {
  if (from === to) return true;
  // Terminal states cannot be re-entered to non-terminal states
  if (from === "HIRED") return false;
  if (from === "WITHDRAWN") return false;
  // From REJECTED, allow re-opening only to APPLIED
  if (from === "REJECTED") return to === "APPLIED";
  return true;
}
