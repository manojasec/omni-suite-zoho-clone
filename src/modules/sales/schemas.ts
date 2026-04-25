import { z } from "zod";
import { DealStatus } from "@prisma/client";

const trim = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).nullable().optional())
    .transform((v) => (v ? v : null));

const decimalString = z
  .preprocess(
    (v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v),
    z.union([z.string(), z.number()]),
  )
  .transform((v, ctx) => {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
      return z.NEVER;
    }
    return n.toFixed(2);
  });

export const dealSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  value: decimalString.optional().default("0.00"),
  currency: trim(8).default("USD"),
  pipelineId: z.string().min(1, "Pipeline is required"),
  stageId: z.string().min(1, "Stage is required"),
  contactId: opt(50),
  companyId: opt(50),
  ownerId: opt(50),
  expectedCloseAt: z
    .preprocess((v) => (typeof v === "string" && v.length > 0 ? new Date(v) : null), z.date().nullable())
    .optional(),
});

export type DealInput = z.infer<typeof dealSchema>;

export const dealStatusSchema = z.object({
  status: z.nativeEnum(DealStatus),
  lostReason: opt(500),
});

export const pipelineSchema = z.object({
  name: trim(120).min(1, "Name is required"),
});

export const stageSchema = z.object({
  name: trim(80).min(1, "Name is required"),
  order: z.coerce.number().int().min(0).max(99),
  probability: z.coerce.number().int().min(0).max(100).default(0),
  pipelineId: z.string().min(1),
});
