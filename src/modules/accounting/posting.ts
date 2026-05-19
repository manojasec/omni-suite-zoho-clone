import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * General-Ledger auto-posting engine.
 *
 * Hook points:
 *   - Invoice transitions to SENT       → postInvoiceToGL(invoiceId)
 *   - Payment recorded on an invoice    → postPaymentToGL(paymentId)
 *   - Expense transitions to APPROVED   → postExpenseToGL(expenseId)
 *
 * Idempotency: each posting writes a JournalEntry with a deterministic
 * `reference`. The schema enforces `@@unique([workspaceId, reference])`,
 * so retries are safe.
 *
 * Account convention (lookup by `code`, configurable per-workspace):
 *   1000 — Cash / Bank             (ASSET)
 *   1100 — Accounts Receivable     (ASSET)
 *   2100 — Accounts Payable        (LIABILITY)
 *   2200 — Tax Payable             (LIABILITY)
 *   4000 — Sales Income            (INCOME)
 *   6000 — General Expenses        (EXPENSE)
 *
 * If a required account doesn't exist, posting is skipped (returns
 * { skipped: true, reason }). This keeps the engine safe to enable on
 * existing workspaces that haven't seeded a chart yet.
 */

export const DEFAULT_ACCOUNTS = {
  CASH: "1000",
  AR: "1100",
  AP: "2100",
  TAX_PAYABLE: "2200",
  SALES: "4000",
  EXPENSE: "6000",
} as const;

export type PostingResult =
  | { ok: true; entryId: string; alreadyPosted: boolean }
  | { ok: false; skipped: true; reason: string };

async function lookupAccountByCode(workspaceId: string, code: string) {
  return prisma.ledgerAccount.findFirst({
    where: { workspaceId, code, archived: false },
    select: { id: true, code: true, type: true },
  });
}

async function findOrPostEntry(opts: {
  workspaceId: string;
  reference: string;
  date: Date;
  memo: string;
  createdById: string;
  lines: { accountId: string; debit: string; credit: string; description?: string }[];
}): Promise<PostingResult> {
  const existing = await prisma.journalEntry.findUnique({
    where: { workspaceId_reference: { workspaceId: opts.workspaceId, reference: opts.reference } },
    select: { id: true },
  });
  if (existing) return { ok: true, entryId: existing.id, alreadyPosted: true };

  // Validate balanced
  let dCents = 0;
  let cCents = 0;
  for (const l of opts.lines) {
    dCents += Math.round(Number(l.debit) * 100);
    cCents += Math.round(Number(l.credit) * 100);
  }
  if (dCents !== cCents) {
    return { ok: false, skipped: true, reason: `Unbalanced: ${dCents} != ${cCents}` };
  }
  if (dCents === 0) {
    return { ok: false, skipped: true, reason: "Zero amount" };
  }

  const entry = await prisma.journalEntry.create({
    data: {
      workspaceId: opts.workspaceId,
      reference: opts.reference,
      date: opts.date,
      memo: opts.memo,
      status: "POSTED",
      postedAt: new Date(),
      createdById: opts.createdById,
      lines: {
        create: opts.lines.map((l, i) => ({
          workspaceId: opts.workspaceId,
          accountId: l.accountId,
          debit: new Prisma.Decimal(l.debit),
          credit: new Prisma.Decimal(l.credit),
          description: l.description ?? null,
          position: i,
        })),
      },
    },
  });
  return { ok: true, entryId: entry.id, alreadyPosted: false };
}

/**
 * Invoice → DR AR, CR Sales (and CR Tax Payable for tax portion).
 */
export async function postInvoiceToGL(invoiceId: string, actorId: string): Promise<PostingResult> {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      workspaceId: true,
      number: true,
      issueDate: true,
      total: true,
      tax: true,
      subtotal: true,
    },
  });
  if (!inv) return { ok: false, skipped: true, reason: "Invoice not found" };
  const total = Number(inv.total);
  if (total <= 0) return { ok: false, skipped: true, reason: "Zero invoice total" };

  const [ar, sales, taxPayable] = await Promise.all([
    lookupAccountByCode(inv.workspaceId, DEFAULT_ACCOUNTS.AR),
    lookupAccountByCode(inv.workspaceId, DEFAULT_ACCOUNTS.SALES),
    lookupAccountByCode(inv.workspaceId, DEFAULT_ACCOUNTS.TAX_PAYABLE),
  ]);
  if (!ar || !sales) {
    return { ok: false, skipped: true, reason: "Chart of accounts missing 1100/4000" };
  }

  const taxAmount = Number(inv.tax);
  const netRevenue = Number(inv.subtotal);
  const lines: Parameters<typeof findOrPostEntry>[0]["lines"] = [
    { accountId: ar.id, debit: total.toFixed(2), credit: "0", description: `Invoice ${inv.number}` },
    { accountId: sales.id, debit: "0", credit: netRevenue.toFixed(2), description: `Sales ${inv.number}` },
  ];
  if (taxAmount > 0 && taxPayable) {
    lines.push({
      accountId: taxPayable.id,
      debit: "0",
      credit: taxAmount.toFixed(2),
      description: `Tax on ${inv.number}`,
    });
  } else if (taxAmount > 0) {
    // Roll tax into sales line if no tax-payable account is configured.
    lines[1].credit = total.toFixed(2);
  }

  return findOrPostEntry({
    workspaceId: inv.workspaceId,
    reference: `INV-${inv.id}`,
    date: inv.issueDate,
    memo: `Auto-posted invoice ${inv.number}`,
    createdById: actorId,
    lines,
  });
}

/**
 * Payment → DR Cash, CR AR.
 */
export async function postPaymentToGL(paymentId: string, actorId: string): Promise<PostingResult> {
  const pay = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, amount: true, paidAt: true, invoice: { select: { workspaceId: true, number: true } } },
  });
  if (!pay) return { ok: false, skipped: true, reason: "Payment not found" };
  const amount = Number(pay.amount);
  if (amount <= 0) return { ok: false, skipped: true, reason: "Zero payment" };
  const wsId = pay.invoice.workspaceId;

  const [cash, ar] = await Promise.all([
    lookupAccountByCode(wsId, DEFAULT_ACCOUNTS.CASH),
    lookupAccountByCode(wsId, DEFAULT_ACCOUNTS.AR),
  ]);
  if (!cash || !ar) {
    return { ok: false, skipped: true, reason: "Chart of accounts missing 1000/1100" };
  }

  return findOrPostEntry({
    workspaceId: wsId,
    reference: `PAY-${pay.id}`,
    date: pay.paidAt,
    memo: `Payment for invoice ${pay.invoice.number}`,
    createdById: actorId,
    lines: [
      { accountId: cash.id, debit: amount.toFixed(2), credit: "0", description: `Cash receipt` },
      { accountId: ar.id, debit: "0", credit: amount.toFixed(2), description: `Settle AR ${pay.invoice.number}` },
    ],
  });
}

/**
 * Expense (APPROVED) → DR Expense, CR AP (or Cash if not reimbursable).
 */
export async function postExpenseToGL(expenseId: string, actorId: string): Promise<PostingResult> {
  const exp = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      workspaceId: true,
      merchant: true,
      expenseDate: true,
      amount: true,
      taxAmount: true,
      reimbursable: true,
    },
  });
  if (!exp) return { ok: false, skipped: true, reason: "Expense not found" };
  const total = Number(exp.amount) + Number(exp.taxAmount);
  if (total <= 0) return { ok: false, skipped: true, reason: "Zero expense" };

  const [expenseAcc, ap, cash] = await Promise.all([
    lookupAccountByCode(exp.workspaceId, DEFAULT_ACCOUNTS.EXPENSE),
    lookupAccountByCode(exp.workspaceId, DEFAULT_ACCOUNTS.AP),
    lookupAccountByCode(exp.workspaceId, DEFAULT_ACCOUNTS.CASH),
  ]);
  if (!expenseAcc) return { ok: false, skipped: true, reason: "Chart of accounts missing 6000" };
  const credit = exp.reimbursable ? ap : cash;
  if (!credit) return { ok: false, skipped: true, reason: "Missing AP/Cash account" };

  return findOrPostEntry({
    workspaceId: exp.workspaceId,
    reference: `EXP-${exp.id}`,
    date: exp.expenseDate,
    memo: `Expense — ${exp.merchant}`,
    createdById: actorId,
    lines: [
      { accountId: expenseAcc.id, debit: total.toFixed(2), credit: "0", description: exp.merchant },
      {
        accountId: credit.id,
        debit: "0",
        credit: total.toFixed(2),
        description: exp.reimbursable ? "Reimbursement payable" : "Paid in cash",
      },
    ],
  });
}

/**
 * Seed a basic chart of accounts for a workspace. Idempotent.
 */
export async function seedDefaultChart(workspaceId: string): Promise<void> {
  const defaults: { code: string; name: string; type: "ASSET" | "LIABILITY" | "INCOME" | "EXPENSE" }[] = [
    { code: DEFAULT_ACCOUNTS.CASH, name: "Cash & Bank", type: "ASSET" },
    { code: DEFAULT_ACCOUNTS.AR, name: "Accounts Receivable", type: "ASSET" },
    { code: DEFAULT_ACCOUNTS.AP, name: "Accounts Payable", type: "LIABILITY" },
    { code: DEFAULT_ACCOUNTS.TAX_PAYABLE, name: "Tax Payable", type: "LIABILITY" },
    { code: DEFAULT_ACCOUNTS.SALES, name: "Sales Income", type: "INCOME" },
    { code: DEFAULT_ACCOUNTS.EXPENSE, name: "General Expenses", type: "EXPENSE" },
  ];
  for (const d of defaults) {
    const exists = await prisma.ledgerAccount.findFirst({
      where: { workspaceId, code: d.code },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.ledgerAccount.create({
      data: { workspaceId, code: d.code, name: d.name, type: d.type },
    });
  }
}
