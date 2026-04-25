"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { expenseSchema } from "@/modules/expenses/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

function fdToObj(fd: FormData) {
  return {
    expenseDate: fd.get("expenseDate") ?? "",
    merchant: fd.get("merchant") ?? "",
    description: fd.get("description") ?? "",
    categoryId: fd.get("categoryId") ?? "",
    currency: fd.get("currency") || "USD",
    amount: fd.get("amount") ?? "0",
    taxAmount: fd.get("taxAmount") ?? "0",
    reimbursable: fd.get("reimbursable") === "on" || fd.get("reimbursable") === "true",
    receiptUrl: fd.get("receiptUrl") ?? "",
    notes: fd.get("notes") ?? "",
  };
}

async function loadOwnedExpense(id: string, workspaceId: string) {
  return prisma.expense.findFirst({
    where: { id, workspaceId },
    select: { id: true, status: true, submittedById: true },
  });
}

export async function createExpenseAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "create");
  const parsed = expenseSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!cat) throw new Error("Invalid category");
  }

  const exp = await prisma.expense.create({
    data: {
      workspaceId: ctx.workspaceId,
      submittedById: ctx.userId,
      categoryId: parsed.data.categoryId || null,
      status: "DRAFT",
      expenseDate: new Date(parsed.data.expenseDate),
      merchant: parsed.data.merchant,
      description: parsed.data.description || null,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      taxAmount: parsed.data.taxAmount,
      reimbursable: parsed.data.reimbursable,
      receiptUrl: parsed.data.receiptUrl || null,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "expense",
    resourceId: exp.id,
  });
  revalidatePath("/app/expenses");
  redirect(`/app/expenses/${exp.id}`);
}

export async function updateExpenseAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "edit");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) throw new Error("Not found");
  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
    throw new Error("Submitted expenses cannot be edited");
  }
  // Submitter (or manager+) can edit
  const isSelf = existing.submittedById === ctx.userId;
  const isManager = ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "MANAGER" || ctx.role === "FINANCE";
  if (!isSelf && !isManager) throw new Error("Not allowed to edit this expense");

  const parsed = expenseSchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  if (parsed.data.categoryId) {
    const cat = await prisma.expenseCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    if (!cat) throw new Error("Invalid category");
  }

  await prisma.expense.update({
    where: { id },
    data: {
      categoryId: parsed.data.categoryId || null,
      expenseDate: new Date(parsed.data.expenseDate),
      merchant: parsed.data.merchant,
      description: parsed.data.description || null,
      currency: parsed.data.currency,
      amount: parsed.data.amount,
      taxAmount: parsed.data.taxAmount,
      reimbursable: parsed.data.reimbursable,
      receiptUrl: parsed.data.receiptUrl || null,
      notes: parsed.data.notes || null,
      // If editing a rejected expense, reset to DRAFT
      ...(existing.status === "REJECTED"
        ? { status: "DRAFT", rejectionReason: null, decidedAt: null, approvedById: null }
        : {}),
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "expense",
    resourceId: id,
  });
  revalidatePath(`/app/expenses/${id}`);
  revalidatePath("/app/expenses");
}

export async function deleteExpenseAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "delete");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) return;
  if (existing.status === "APPROVED" || existing.status === "REIMBURSED") {
    throw new Error("Approved or reimbursed expenses cannot be deleted");
  }
  await prisma.expense.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "expense",
    resourceId: id,
  });
  revalidatePath("/app/expenses");
  redirect("/app/expenses");
}

export async function submitExpenseAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "edit");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) throw new Error("Not found");
  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
    throw new Error("Already submitted");
  }
  await prisma.expense.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      rejectionReason: null,
      decidedAt: null,
      approvedById: null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "submit",
    resource: "expense",
    resourceId: id,
  });
  revalidatePath(`/app/expenses/${id}`);
  revalidatePath("/app/expenses");
}

export async function approveExpenseAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "manage");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) throw new Error("Not found");
  if (existing.status !== "SUBMITTED") throw new Error("Not in submitted state");
  await prisma.expense.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: ctx.userId,
      decidedAt: new Date(),
      rejectionReason: null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "approve",
    resource: "expense",
    resourceId: id,
  });
  revalidatePath(`/app/expenses/${id}`);
  revalidatePath("/app/expenses");
}

export async function rejectExpenseAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "manage");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) throw new Error("Not found");
  if (existing.status !== "SUBMITTED") throw new Error("Not in submitted state");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 2000);
  await prisma.expense.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: ctx.userId,
      decidedAt: new Date(),
      rejectionReason: reason || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "reject",
    resource: "expense",
    resourceId: id,
    diff: { reason },
  });
  revalidatePath(`/app/expenses/${id}`);
  revalidatePath("/app/expenses");
}

export async function reimburseExpenseAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expense", "manage");
  const existing = await loadOwnedExpense(id, ctx.workspaceId);
  if (!existing) throw new Error("Not found");
  if (existing.status !== "APPROVED") throw new Error("Must be approved before reimbursing");
  await prisma.expense.update({
    where: { id },
    data: {
      status: "REIMBURSED",
      reimbursedAt: new Date(),
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "reimburse",
    resource: "expense",
    resourceId: id,
  });
  revalidatePath(`/app/expenses/${id}`);
  revalidatePath("/app/expenses");
}
