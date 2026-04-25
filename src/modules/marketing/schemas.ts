import { z } from "zod";
import { CampaignStatus } from "@prisma/client";

const trim = (max: number) => z.string().trim().max(max);

const dateOpt = z
  .preprocess((v) => (typeof v === "string" && v.length > 0 ? new Date(v) : null), z.date().nullable())
  .optional();

/**
 * The audience filter DSL. We keep it intentionally small for MVP — every
 * filter narrows the workspace's Contact set.
 *   stage    : LifecycleStage[] (any-of)
 *   tag      : string[] (contact must have any of these tags)
 *   hasEmail : boolean
 */
export const audienceFilterSchema = z.object({
  stage: z.array(z.enum(["LEAD", "MQL", "SQL", "CUSTOMER", "CHURNED"])).optional(),
  tag: z.array(z.string().max(40)).optional(),
  hasEmail: z.boolean().optional(),
});

export const audienceSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  filterDsl: audienceFilterSchema,
});

export const campaignSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  audienceId: trim(50).optional().transform((v) => (v && v.length > 0 ? v : null)),
  subject: trim(300).min(1, "Subject is required"),
  html: trim(40_000).min(1, "Body is required"),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  scheduledAt: dateOpt,
});

export const sendCampaignSchema = z.object({
  scheduledAt: dateOpt,
});
