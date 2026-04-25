import { z } from "zod";
import { InvoiceStatus } from "@prisma/client";

const trim = (max: number) => z.string().trim().max(max);
const opt = (max: number) =>
  z
    .preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().max(max).nullable().optional())
    .transform((v) => (v ? v : null));

const decimal = (opts: { allowZero?: boolean; max?: number } = {}) =>
  z
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
      if (!opts.allowZero && n === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount must be greater than 0" });
        return z.NEVER;
      }
      if (opts.max !== undefined && n > opts.max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Must be ≤ ${opts.max}` });
        return z.NEVER;
      }
      return n.toFixed(2);
    });

export const customerSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  email: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.string().email().or(z.literal("")).optional(),
    )
    .transform((v) => (v && v !== "" ? v : null)),
  companyId: opt(50),
  billingAddress: opt(2000),
  taxId: opt(80),
  currency: trim(8).default("USD"),
});

export const productSchema = z.object({
  name: trim(200).min(1, "Name is required"),
  sku: opt(80),
  price: decimal({ allowZero: true }).default("0.00"),
  taxPercent: decimal({ allowZero: true, max: 100 }).default("0.00"),
});

export const lineItemSchema = z.object({
  description: trim(500).min(1, "Description is required"),
  qty: decimal({ allowZero: false }).default("1.00"),
  unitPrice: decimal({ allowZero: true }).default("0.00"),
  taxPercent: decimal({ allowZero: true, max: 100 }).default("0.00"),
});

export const invoiceSchema = z.object({
  customerId: trim(50).min(1, "Customer is required"),
  dealId: opt(50),
  projectId: opt(50),
  number: opt(60),
  issueDate: z
    .preprocess((v) => (typeof v === "string" && v ? new Date(v) : new Date()), z.date())
    .default(() => new Date()),
  dueDate: z
    .preprocess((v) => (typeof v === "string" && v.length > 0 ? new Date(v) : null), z.date().nullable())
    .optional(),
  currency: trim(8).default("USD"),
  notes: opt(5000),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;

export const paymentSchema = z.object({
  amount: decimal({ allowZero: false }),
  method: trim(40).min(1, "Method is required"),
  reference: opt(120),
  paidAt: z
    .preprocess((v) => (typeof v === "string" && v ? new Date(v) : new Date()), z.date())
    .default(() => new Date()),
});

export const invoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});
