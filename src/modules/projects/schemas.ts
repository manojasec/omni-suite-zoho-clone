import { z } from "zod";
import { ProjectStatus, TaskStatus, Priority } from "@prisma/client";

const trim = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).nullable().optional())
    .transform((v) => (v ? v : null));

const decimalString = z
  .preprocess(
    (v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v),
    z.union([z.string(), z.number()]).nullable().optional(),
  )
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
      return z.NEVER;
    }
    return n.toFixed(2);
  });

const dateOpt = z
  .preprocess(
    (v) => (typeof v === "string" && v.length > 0 ? new Date(v) : null),
    z.date().nullable(),
  )
  .optional();

const intOpt = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim().length > 0 ? Number(v) : v === "" ? null : v),
    z.number().int().nonnegative().nullable().optional(),
  )
  .transform((v) => (v == null ? null : v));

export const projectSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  description: opt(2000),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  startDate: dateOpt,
  endDate: dateOpt,
  budgetHours: intOpt,
  budgetAmount: decimalString,
});

export const taskSchema = z.object({
  title: trim(300).min(1, "Title is required"),
  description: opt(4000),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  projectId: opt(50),
  parentTaskId: opt(50),
  assigneeId: opt(50),
  dueAt: dateOpt,
});

export const taskStatusMoveSchema = z.object({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
});
