"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  addEmployeeToPayRunSchema,
  aggregateRunTotals,
  defaultItemsFromSalary,
  payItemSchema,
  payRunSchema,
  summarizePaySlip,
} from "@/modules/payroll/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function loadPayRun(workspaceId: string, payRunId: string) {
  const pr = await prisma.payRun.findFirst({ where: { id: payRunId, workspaceId } });
  if (!pr) throw new Error("Pay run not found");
  return pr;
}

async function loadSlip(workspaceId: string, slipId: string) {
  const slip = await prisma.paySlip.findFirst({
    where: { id: slipId, payRun: { workspaceId } },
    include: { payRun: { select: { id: true, status: true } } },
  });
  if (!slip) throw new Error("Pay slip not found");
  return slip;
}

async function recomputeSlipTotals(slipId: string) {
  const items = await prisma.paySlipItem.findMany({
    where: { paySlipId: slipId },
    select: { kind: true, amount: true },
  });
  const totals = summarizePaySlip(
    items.map((i) => ({ kind: i.kind, amount: i.amount })),
  );
  await prisma.paySlip.update({
    where: { id: slipId },
    data: {
      gross: new Prisma.Decimal(totals.gross),
      deductions: new Prisma.Decimal(totals.deductions),
      tax: new Prisma.Decimal(totals.tax),
      net: new Prisma.Decimal(totals.net),
    },
  });
}

async function recomputeRunTotals(payRunId: string) {
  const slips = await prisma.paySlip.findMany({
    where: { payRunId },
    select: { gross: true, deductions: true, tax: true, net: true },
  });
  const totals = aggregateRunTotals(slips);
  await prisma.payRun.update({
    where: { id: payRunId },
    data: {
      totalGross: new Prisma.Decimal(totals.totalGross),
      totalDeductions: new Prisma.Decimal(totals.totalDeductions),
      totalTax: new Prisma.Decimal(totals.totalTax),
      totalNet: new Prisma.Decimal(totals.totalNet),
    },
  });
}

function ensureDraft(status: string) {
  if (status !== "DRAFT") throw new Error("Pay run must be in DRAFT to edit");
}

export async function createPayRunAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "create");

  const parsed = payRunSchema.safeParse({
    label: s(fd, "label"),
    periodStart: s(fd, "periodStart"),
    periodEnd: s(fd, "periodEnd"),
    payDate: s(fd, "payDate"),
    currency: s(fd, "currency") || "USD",
    notes: s(fd, "notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const run = await prisma.payRun.create({
    data: {
      workspaceId: ctx.workspaceId,
      label: parsed.data.label,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      payDate: parsed.data.payDate,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
      createdById: ctx.userId,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "payRun",
    resourceId: run.id,
    diff: { label: run.label, payDate: run.payDate.toISOString() },
  });

  revalidatePath("/app/hr/payroll");
  redirect(`/app/hr/payroll/${run.id}`);
}

export async function approvePayRunAction(payRunId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "manage");
  const run = await loadPayRun(ctx.workspaceId, payRunId);
  if (run.status !== "DRAFT") throw new Error("Only DRAFT runs can be approved");

  const slipCount = await prisma.paySlip.count({ where: { payRunId: run.id } });
  if (slipCount === 0) throw new Error("Add at least one employee before approving");

  await recomputeRunTotals(run.id);
  await prisma.payRun.update({
    where: { id: run.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "payRun",
    resourceId: run.id,
    diff: { status: "APPROVED" },
  });

  revalidatePath(`/app/hr/payroll/${run.id}`);
  revalidatePath("/app/hr/payroll");
}

export async function markPayRunPaidAction(payRunId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "manage");
  const run = await loadPayRun(ctx.workspaceId, payRunId);
  if (run.status !== "APPROVED") throw new Error("Only APPROVED runs can be marked paid");

  await prisma.payRun.update({
    where: { id: run.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "payRun",
    resourceId: run.id,
    diff: { status: "PAID" },
  });

  revalidatePath(`/app/hr/payroll/${run.id}`);
  revalidatePath("/app/hr/payroll");
}

export async function cancelPayRunAction(payRunId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "manage");
  const run = await loadPayRun(ctx.workspaceId, payRunId);
  if (run.status === "PAID") throw new Error("Paid runs cannot be canceled");

  await prisma.payRun.update({
    where: { id: run.id },
    data: { status: "CANCELED" },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "payRun",
    resourceId: run.id,
    diff: { status: "CANCELED" },
  });

  revalidatePath(`/app/hr/payroll/${run.id}`);
  revalidatePath("/app/hr/payroll");
}

export async function deletePayRunAction(payRunId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "delete");
  const run = await loadPayRun(ctx.workspaceId, payRunId);
  if (run.status === "PAID") throw new Error("Paid runs cannot be deleted");

  await prisma.payRun.delete({ where: { id: run.id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "payRun",
    resourceId: run.id,
    diff: { label: run.label },
  });

  revalidatePath("/app/hr/payroll");
  redirect("/app/hr/payroll");
}

export async function addEmployeeToPayRunAction(payRunId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "paySlip", "create");
  const run = await loadPayRun(ctx.workspaceId, payRunId);
  ensureDraft(run.status);

  const parsed = addEmployeeToPayRunSchema.safeParse({
    employeeId: s(fd, "employeeId"),
    baseSalary: s(fd, "baseSalary") || "0",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await prisma.employee.findFirst({
    where: { id: parsed.data.employeeId, workspaceId: ctx.workspaceId },
  });
  if (!employee) throw new Error("Employee not found");

  const items = defaultItemsFromSalary(parsed.data.baseSalary);
  const totals = summarizePaySlip(items);

  let slip;
  try {
    slip = await prisma.paySlip.create({
      data: {
        payRunId: run.id,
        employeeId: employee.id,
        gross: new Prisma.Decimal(totals.gross),
        deductions: new Prisma.Decimal(totals.deductions),
        tax: new Prisma.Decimal(totals.tax),
        net: new Prisma.Decimal(totals.net),
        items: {
          create: items.map((i) => ({
            kind: i.kind,
            label: i.label,
            amount: new Prisma.Decimal(i.amount),
          })),
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Employee already on this pay run");
    }
    throw e;
  }

  await recomputeRunTotals(run.id);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "paySlip",
    resourceId: slip.id,
    diff: { payRunId: run.id, employeeId: employee.id, gross: totals.gross },
  });

  revalidatePath(`/app/hr/payroll/${run.id}`);
}

export async function removeSlipAction(slipId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "paySlip", "delete");
  const slip = await loadSlip(ctx.workspaceId, slipId);
  ensureDraft(slip.payRun.status);

  await prisma.paySlip.delete({ where: { id: slip.id } });
  await recomputeRunTotals(slip.payRunId);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "paySlip",
    resourceId: slip.id,
    diff: { payRunId: slip.payRunId },
  });

  revalidatePath(`/app/hr/payroll/${slip.payRunId}`);
}

export async function addPayItemAction(slipId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "paySlip", "edit");
  const slip = await loadSlip(ctx.workspaceId, slipId);
  ensureDraft(slip.payRun.status);

  const parsed = payItemSchema.safeParse({
    kind: s(fd, "kind"),
    label: s(fd, "label"),
    amount: s(fd, "amount") || "0",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  await prisma.paySlipItem.create({
    data: {
      paySlipId: slip.id,
      kind: parsed.data.kind,
      label: parsed.data.label,
      amount: new Prisma.Decimal(parsed.data.amount),
    },
  });

  await recomputeSlipTotals(slip.id);
  await recomputeRunTotals(slip.payRunId);

  revalidatePath(`/app/hr/payroll/${slip.payRunId}/slips/${slip.id}`);
  revalidatePath(`/app/hr/payroll/${slip.payRunId}`);
}

export async function deletePayItemAction(itemId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "paySlip", "edit");

  const item = await prisma.paySlipItem.findFirst({
    where: { id: itemId, paySlip: { payRun: { workspaceId: ctx.workspaceId } } },
    include: { paySlip: { select: { id: true, payRunId: true, payRun: { select: { status: true } } } } },
  });
  if (!item) throw new Error("Pay item not found");
  ensureDraft(item.paySlip.payRun.status);

  await prisma.paySlipItem.delete({ where: { id: item.id } });
  await recomputeSlipTotals(item.paySlip.id);
  await recomputeRunTotals(item.paySlip.payRunId);

  revalidatePath(`/app/hr/payroll/${item.paySlip.payRunId}/slips/${item.paySlip.id}`);
  revalidatePath(`/app/hr/payroll/${item.paySlip.payRunId}`);
}
