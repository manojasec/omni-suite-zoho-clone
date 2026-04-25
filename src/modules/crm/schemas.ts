/**
 * CRM module — Zod schemas (single source of truth for both server actions
 * and any future REST endpoints).
 */
import { z } from "zod";
import { ActivityType, LifecycleStage } from "@prisma/client";

const trimmedString = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max));
const optionalString = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max))
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const contactSchema = z.object({
  firstName: trimmedString(80).pipe(z.string().min(1, "First name is required")),
  lastName: optionalString(80),
  email: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.string().max(200),
    )
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  phone: optionalString(50),
  title: optionalString(120),
  companyId: optionalString(40),
  ownerId: optionalString(40),
  lifecycleStage: z.nativeEnum(LifecycleStage).default(LifecycleStage.LEAD),
  source: optionalString(80),
  tags: z
    .preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : v,
      z.array(z.string().min(1).max(40)).max(20),
    )
    .default([]),
  notes: optionalString(5000),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const companySchema = z.object({
  name: trimmedString(160).pipe(z.string().min(1, "Name is required")),
  domain: optionalString(120),
  industry: optionalString(80),
  size: optionalString(40),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const activitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  subject: trimmedString(200).pipe(z.string().min(1, "Subject is required")),
  body: optionalString(5000),
  contactId: optionalString(40),
  dealId: optionalString(40),
  dueAt: z
    .preprocess((v) => (v && typeof v === "string" ? new Date(v) : v), z.date())
    .optional(),
});
export type ActivityInput = z.infer<typeof activitySchema>;
