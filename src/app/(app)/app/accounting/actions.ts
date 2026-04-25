"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  bankAccountSchema,
  bankTransactionSchema,
  journalEntrySchema,
  ledgerAccountSchema,
} from "@/modules/accounting/schemas";

function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}
function fdAll(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => (v == null ? "" : String(v)));
}

// ===== Ledger Accounts =====

export async function createLedgerAccountAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "create");
  const parsed = ledgerAccountSchema.safeParse({
    code: fdString(fd, "code"),
    name: fdString(fd, "name"),
    type: fdString(fd, "type"),
    parentId: fdString(fd, "parentId") || undefined,
    description: fdString(fd, "description") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const acc = await prisma.ledgerAccount.create({
    data: {
      workspaceId: ctx.workspaceId,
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      parentId: parsed.data.parentId || null,
      description: parsed.data.description || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "ledgerAccount",
    resourceId: acc.id,
    diff: { code: acc.code, name: acc.name },
  });
  redirect("/app/accounting/accounts");
}

export async function updateLedgerAccountAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "edit");
  const existing = await prisma.ledgerAccount.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  const parsed = ledgerAccountSchema.safeParse({
    code: fdString(fd, "code"),
    name: fdString(fd, "name"),
    type: fdString(fd, "type"),
    parentId: fdString(fd, "parentId") || undefined,
    description: fdString(fd, "description") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.ledgerAccount.update({
    where: { id },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type,
      parentId: parsed.data.parentId || null,
      description: parsed.data.description || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "ledgerAccount",
    resourceId: id,
  });
  redirect("/app/accounting/accounts");
}

export async function archiveLedgerAccountAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "ledgerAccount", "delete");
  const existing = await prisma.ledgerAccount.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Not found");
  await prisma.ledgerAccount.update({ where: { id }, data: { archived: !existing.archived } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "ledgerAccount",
    resourceId: id,
    diff: { archived: !existing.archived },
  });
  redirect("/app/accounting/accounts");
}

// ===== Journal Entries =====

function parseEntryFromForm(fd: FormData) {
  const accountIds = fdAll(fd, "accountId");
  const debits = fdAll(fd, "debit");
  const credits = fdAll(fd, "credit");
  const descs = fdAll(fd, "lineDescription");
  const lines = accountIds
    .map((accountId, i) => ({
      accountId: accountId.trim(),
      debit: Number(debits[i] || 0),
      credit: Number(credits[i] || 0),
      description: (descs[i] ?? "").trim(),
    }))
    .filter((l) => l.accountId.length > 0);
  return journalEntrySchema.safeParse({
    reference: fdString(fd, "reference"),
    date: fdString(fd, "date"),
    memo: fdString(fd, "memo") || undefined,
    lines,
  });
}

export async function createJournalEntryAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "create");
  const parsed = parseEntryFromForm(fd);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid entry");
  // Verify all accounts belong to this workspace
  const ids = Array.from(new Set(parsed.data.lines.map((l) => l.accountId)));
  const accountCount = await prisma.ledgerAccount.count({
    where: { workspaceId: ctx.workspaceId, id: { in: ids } },
  });
  if (accountCount !== ids.length) throw new Error("Invalid account selection");

  const entry = await prisma.$transaction(async (tx) => {
    const e = await tx.journalEntry.create({
      data: {
        workspaceId: ctx.workspaceId,
        reference: parsed.data.reference,
        date: parsed.data.date,
        memo: parsed.data.memo || null,
        createdById: ctx.userId,
        status: "DRAFT",
        lines: {
          create: parsed.data.lines.map((l, i) => ({
            workspaceId: ctx.workspaceId,
            accountId: l.accountId,
            debit: new Prisma.Decimal(l.debit),
            credit: new Prisma.Decimal(l.credit),
            description: l.description || null,
            position: i,
          })),
        },
      },
    });
    return e;
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "journalEntry",
    resourceId: entry.id,
    diff: { reference: entry.reference },
  });
  redirect(`/app/accounting/journals/${entry.id}`);
}

export async function postJournalEntryAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "manage");
  const e = await prisma.journalEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!e) throw new Error("Not found");
  if (e.status !== "DRAFT") throw new Error(`Cannot post ${e.status.toLowerCase()} entry`);
  await prisma.journalEntry.update({
    where: { id },
    data: { status: "POSTED", postedAt: new Date() },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "manage",
    resource: "journalEntry",
    resourceId: id,
    diff: { status: "POSTED" },
  });
  redirect(`/app/accounting/journals/${id}`);
}

export async function voidJournalEntryAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "manage");
  const e = await prisma.journalEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!e) throw new Error("Not found");
  if (e.status === "VOID") throw new Error("Already voided");
  await prisma.journalEntry.update({ where: { id }, data: { status: "VOID" } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "manage",
    resource: "journalEntry",
    resourceId: id,
    diff: { status: "VOID" },
  });
  redirect(`/app/accounting/journals/${id}`);
}

export async function deleteJournalEntryAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "journalEntry", "delete");
  const e = await prisma.journalEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!e) throw new Error("Not found");
  if (e.status === "POSTED") throw new Error("Void posted entries instead of deleting");
  await prisma.journalEntry.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "journalEntry",
    resourceId: id,
  });
  redirect("/app/accounting/journals");
}

// ===== Bank Accounts =====

export async function createBankAccountAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bankAccount", "create");
  const parsed = bankAccountSchema.safeParse({
    ledgerAccountId: fdString(fd, "ledgerAccountId"),
    name: fdString(fd, "name"),
    bankName: fdString(fd, "bankName") || undefined,
    accountNumberLast4: fdString(fd, "accountNumberLast4") || undefined,
    currency: fdString(fd, "currency") || "USD",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ledger = await prisma.ledgerAccount.findFirst({
    where: { id: parsed.data.ledgerAccountId, workspaceId: ctx.workspaceId, type: "ASSET" },
  });
  if (!ledger) throw new Error("Pick an existing asset account in the chart of accounts");

  const ba = await prisma.bankAccount.create({
    data: {
      workspaceId: ctx.workspaceId,
      ledgerAccountId: parsed.data.ledgerAccountId,
      name: parsed.data.name,
      bankName: parsed.data.bankName || null,
      accountNumberLast4: parsed.data.accountNumberLast4 || null,
      currency: parsed.data.currency,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "bankAccount",
    resourceId: ba.id,
    diff: { name: ba.name },
  });
  redirect(`/app/accounting/banks/${ba.id}`);
}

export async function createBankTransactionAction(bankAccountId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bankTransaction", "create");
  const ba = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, workspaceId: ctx.workspaceId },
  });
  if (!ba) throw new Error("Not found");
  const parsed = bankTransactionSchema.safeParse({
    date: fdString(fd, "date"),
    description: fdString(fd, "description"),
    amount: fdString(fd, "amount"),
    reference: fdString(fd, "reference") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const txn = await prisma.bankTransaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      bankAccountId,
      date: parsed.data.date,
      description: parsed.data.description,
      amount: new Prisma.Decimal(parsed.data.amount),
      reference: parsed.data.reference || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "bankTransaction",
    resourceId: txn.id,
    diff: { amount: parsed.data.amount, description: parsed.data.description },
  });
  redirect(`/app/accounting/banks/${bankAccountId}`);
}

export async function toggleReconcileAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "bankTransaction", "manage");
  const t = await prisma.bankTransaction.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!t) throw new Error("Not found");
  const nowReconciled = t.status !== "RECONCILED";
  await prisma.bankTransaction.update({
    where: { id },
    data: {
      status: nowReconciled ? "RECONCILED" : "UNRECONCILED",
      reconciledAt: nowReconciled ? new Date() : null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "manage",
    resource: "bankTransaction",
    resourceId: id,
    diff: { status: nowReconciled ? "RECONCILED" : "UNRECONCILED" },
  });
  redirect(`/app/accounting/banks/${t.bankAccountId}`);
}
