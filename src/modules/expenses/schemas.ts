import { z } from "zod";

const num = z.coerce.number();

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: z.string().trim().max(20).optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  expenseDate: z.string().min(1, "Date is required"),
  merchant: z.string().trim().min(1, "Merchant is required").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  currency: z.string().length(3).default("USD"),
  amount: num.min(0.01, "Amount must be greater than zero"),
  taxAmount: num.min(0).default(0),
  reimbursable: z.coerce.boolean().optional().default(true),
  receiptUrl: z.string().trim().url("Must be a valid URL").max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const expenseDecisionSchema = z.object({
  reason: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
