import { z } from "zod";

export const LEDGER_ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] as const;
export const JOURNAL_ENTRY_STATUSES = ["DRAFT", "POSTED", "VOID"] as const;
export const BANK_TXN_STATUSES = ["UNRECONCILED", "RECONCILED"] as const;

export const ledgerAccountSchema = z.object({
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9.\-]+$/, "Use letters, digits, dot, dash"),
  name: z.string().trim().min(1).max(120),
  type: z.enum(LEDGER_ACCOUNT_TYPES),
  parentId: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type LedgerAccountInput = z.infer<typeof ledgerAccountSchema>;

const moneyAmount = z.coerce
  .number()
  .nonnegative()
  .max(999_999_999_999.99)
  .refine((n) => Number.isFinite(n), "Invalid amount");

export const journalLineSchema = z
  .object({
    accountId: z.string().trim().min(1, "Account required"),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    debit: moneyAmount.default(0),
    credit: moneyAmount.default(0),
  })
  .refine((l) => !(l.debit > 0 && l.credit > 0), "A line cannot have both debit and credit")
  .refine((l) => l.debit > 0 || l.credit > 0, "Each line must have a debit or credit > 0");

export const journalEntrySchema = z
  .object({
    reference: z.string().trim().min(1).max(50),
    date: z.coerce.date(),
    memo: z.string().trim().max(500).optional().or(z.literal("")),
    lines: z.array(journalLineSchema).min(2, "At least two lines"),
  })
  .superRefine((entry, ctx) => {
    const debitSum = entry.lines.reduce((acc, l) => acc + l.debit, 0);
    const creditSum = entry.lines.reduce((acc, l) => acc + l.credit, 0);
    // Use cents to avoid floating-point drift
    const dCents = Math.round(debitSum * 100);
    const cCents = Math.round(creditSum * 100);
    if (dCents !== cCents) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Entry not balanced: debits ${(dCents / 100).toFixed(2)} ≠ credits ${(cCents / 100).toFixed(2)}`,
        path: ["lines"],
      });
    }
    if (dCents === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Entry total cannot be zero", path: ["lines"] });
    }
  });
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

export const bankAccountSchema = z.object({
  ledgerAccountId: z.string().trim().min(1, "Ledger account required"),
  name: z.string().trim().min(1).max(120),
  bankName: z.string().trim().max(120).optional().or(z.literal("")),
  accountNumberLast4: z.string().trim().regex(/^\d{0,4}$/, "Up to 4 digits").optional().or(z.literal("")),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "ISO 4217 code").default("USD"),
});

export const bankTransactionSchema = z
  .object({
    date: z.coerce.date(),
    description: z.string().trim().min(1).max(200),
    amount: z.coerce.number().refine((n) => n !== 0, "Amount cannot be zero"),
    reference: z.string().trim().max(80).optional().or(z.literal("")),
  });

/**
 * Compute account balances from a flat list of posted journal lines.
 * Asset and Expense accounts are debit-normal: balance = debit - credit.
 * Liability, Equity, Income are credit-normal: balance = credit - debit.
 */
export type AccountBalanceInput = {
  accountId: string;
  type: (typeof LEDGER_ACCOUNT_TYPES)[number];
  debit: number;
  credit: number;
};

export function normalBalance(input: AccountBalanceInput): number {
  const isDebitNormal = input.type === "ASSET" || input.type === "EXPENSE";
  return isDebitNormal ? input.debit - input.credit : input.credit - input.debit;
}

/** Sum lines per account for trial balance / financial statements. */
export function aggregateLines(
  lines: { accountId: string; debit: number; credit: number }[],
): Map<string, { debit: number; credit: number }> {
  const m = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const cur = m.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += l.debit;
    cur.credit += l.credit;
    m.set(l.accountId, cur);
  }
  return m;
}
