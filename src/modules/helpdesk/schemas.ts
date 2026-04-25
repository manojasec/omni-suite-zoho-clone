import { z } from "zod";
import { TicketStatus, Priority } from "@prisma/client";

const trim = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).nullable().optional())
    .transform((v) => (v ? v : null));

const dateOpt = z
  .preprocess((v) => (typeof v === "string" && v.length > 0 ? new Date(v) : null), z.date().nullable())
  .optional();

const tagsField = z
  .preprocess(
    (v) =>
      typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter(Boolean)
        : Array.isArray(v) ? v : [],
    z.array(z.string().max(40)).max(20),
  );

export const ticketSchema = z.object({
  subject: trim(300).min(1, "Subject is required"),
  description: opt(8000),
  status: z.nativeEnum(TicketStatus).default(TicketStatus.OPEN),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  requesterContactId: opt(50),
  assigneeId: opt(50),
  channel: trim(40).default("web"),
  tags: tagsField.default([]),
  firstResponseAt: dateOpt,
  resolvedAt: dateOpt,
});

export const ticketStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
});

export const ticketMessageSchema = z.object({
  body: trim(8000).min(1, "Message body is required"),
  isInternal: z.preprocess((v) => v === "on" || v === true || v === "true", z.boolean()).default(false),
});
