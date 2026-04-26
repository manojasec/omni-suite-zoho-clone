"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  addInterval,
  computeInitialPeriod,
  formatInvoiceNumber,
  isValidSubscriptionTransition,
  subscriptionPlanSchema,
  subscriptionSchema,
  subscriptionUpdateSchema,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_INVOICE_STATUSES,
} from "@/modules/subscriptions/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ===== Plans =====

export async function createPlanAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "create");
  const parsed = subscriptionPlanSchema.safeParse({
    name: s(fd, "name"),
    code: s(fd, "code"),
    description: s(fd, "description"),
    amount: s(fd, "amount"),
    currency: s(fd, "currency") || "USD",
    interval: s(fd, "interval") || "MONTH",
    intervalCount: s(fd, "intervalCount") || "1",
    trialDays: s(fd, "trialDays") || "0",
    active: s(fd, "active") === "on" || s(fd, "active") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const plan = await prisma.subscriptionPlan.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description || null,
      amount: new Prisma.Decimal(parsed.data.amount),
      currency: parsed.data.currency,
      interval: parsed.data.interval,
      intervalCount: parsed.data.intervalCount,
      trialDays: parsed.data.trialDays,
      active: parsed.data.active,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "subscriptionPlan",
    resourceId: plan.id,
    diff: { name: plan.name, code: plan.code, amount: parsed.data.amount },
  });
  redirect(`/app/subscriptions/plans/${plan.id}`);
}

export async function updatePlanAction(planId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "edit");
  const existing = await prisma.subscriptionPlan.findFirst({
    where: { id: planId, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Plan not found");
  const parsed = subscriptionPlanSchema.safeParse({
    name: s(fd, "name"),
    code: s(fd, "code"),
    description: s(fd, "description"),
    amount: s(fd, "amount"),
    currency: s(fd, "currency") || "USD",
    interval: s(fd, "interval") || "MONTH",
    intervalCount: s(fd, "intervalCount") || "1",
    trialDays: s(fd, "trialDays") || "0",
    active: s(fd, "active") === "on" || s(fd, "active") === "true",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      description: parsed.data.description || null,
      amount: new Prisma.Decimal(parsed.data.amount),
      currency: parsed.data.currency,
      interval: parsed.data.interval,
      intervalCount: parsed.data.intervalCount,
      trialDays: parsed.data.trialDays,
      active: parsed.data.active,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscriptionPlan",
    resourceId: planId,
    diff: { code: { from: existing.code, to: parsed.data.code } },
  });
  redirect(`/app/subscriptions/plans/${planId}`);
}

export async function archivePlanAction(planId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "edit");
  const existing = await prisma.subscriptionPlan.findFirst({
    where: { id: planId, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Plan not found");
  await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: { active: !existing.active },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscriptionPlan",
    resourceId: planId,
    diff: { active: { from: existing.active, to: !existing.active } },
  });
}

// ===== Subscriptions =====

export async function createSubscriptionAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "create");
  const parsed = subscriptionSchema.safeParse({
    planId: s(fd, "planId"),
    customerName: s(fd, "customerName"),
    customerEmail: s(fd, "customerEmail"),
    quantity: s(fd, "quantity") || "1",
    startedAt: s(fd, "startedAt"),
    notes: s(fd, "notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: parsed.data.planId, workspaceId: ctx.workspaceId },
  });
  if (!plan) throw new Error("Plan not found");
  if (!plan.active) throw new Error("Plan is archived");
  const period = computeInitialPeriod({
    startedAt: parsed.data.startedAt,
    trialDays: plan.trialDays,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
  });
  const sub = await prisma.subscription.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      planId: plan.id,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      quantity: parsed.data.quantity,
      startedAt: parsed.data.startedAt,
      trialEndsAt: period.trialEndsAt,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      status: period.status,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "subscription",
    resourceId: sub.id,
    diff: { plan: plan.code, customer: parsed.data.customerEmail, status: period.status },
  });
  redirect(`/app/subscriptions/${sub.id}`);
}

export async function updateSubscriptionAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "edit");
  const existing = await prisma.subscription.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Subscription not found");
  const parsed = subscriptionUpdateSchema.safeParse({
    customerName: s(fd, "customerName"),
    customerEmail: s(fd, "customerEmail"),
    quantity: s(fd, "quantity"),
    notes: s(fd, "notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.subscription.update({
    where: { id },
    data: {
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      quantity: parsed.data.quantity,
      notes: parsed.data.notes || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscription",
    resourceId: id,
    diff: { quantity: { from: existing.quantity, to: parsed.data.quantity } },
  });
  redirect(`/app/subscriptions/${id}`);
}

export async function changeSubscriptionStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "edit");
  const status = s(fd, "status");
  if (!SUBSCRIPTION_STATUSES.includes(status as never)) throw new Error("Invalid status");
  const existing = await prisma.subscription.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Subscription not found");
  if (!isValidSubscriptionTransition(existing.status, status as (typeof SUBSCRIPTION_STATUSES)[number])) {
    throw new Error(`Cannot transition from ${existing.status} to ${status}`);
  }
  const data: { status: (typeof SUBSCRIPTION_STATUSES)[number]; canceledAt?: Date | null } = {
    status: status as (typeof SUBSCRIPTION_STATUSES)[number],
  };
  if (status === "CANCELED") data.canceledAt = new Date();
  if (status === "ACTIVE" && existing.status === "PAUSED") data.canceledAt = null;
  await prisma.subscription.update({ where: { id }, data });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscription",
    resourceId: id,
    diff: { status: { from: existing.status, to: status } },
  });
}

export async function toggleCancelAtPeriodEndAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "edit");
  const existing = await prisma.subscription.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Subscription not found");
  await prisma.subscription.update({
    where: { id },
    data: { cancelAtPeriodEnd: !existing.cancelAtPeriodEnd },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscription",
    resourceId: id,
    diff: { cancelAtPeriodEnd: { from: existing.cancelAtPeriodEnd, to: !existing.cancelAtPeriodEnd } },
  });
}

// ===== Invoices =====

/** Generate a draft invoice for the current period of a subscription, then advance the period. */
export async function generateInvoiceAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionInvoice", "create");
  const sub = await prisma.subscription.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { plan: true },
  });
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "CANCELED" || sub.status === "EXPIRED") {
    throw new Error("Subscription is not active");
  }
  const periodStart = sub.currentPeriodStart;
  const periodEnd = sub.currentPeriodEnd;
  const amountPerUnit = new Prisma.Decimal(sub.plan.amount.toString());
  const total = amountPerUnit.mul(sub.quantity);

  const year = new Date().getUTCFullYear();
  // Sequence: count of invoices in this workspace this year + 1.
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const seq = (await prisma.subscriptionInvoice.count({
    where: { workspaceId: ctx.workspaceId, issuedAt: { gte: yearStart } },
  })) + 1;
  const number = formatInvoiceNumber(year, seq);

  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      subscriptionId: sub.id,
      number,
      status: "OPEN",
      amount: total,
      currency: sub.plan.currency,
      periodStart,
      periodEnd,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Advance subscription period.
  const nextEnd = addInterval(periodEnd, sub.plan.interval, sub.plan.intervalCount);
  const nextStatus =
    sub.status === "TRIALING" ? "ACTIVE" : sub.cancelAtPeriodEnd ? "CANCELED" : sub.status;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: periodEnd,
      currentPeriodEnd: nextEnd,
      status: nextStatus,
      canceledAt: nextStatus === "CANCELED" ? new Date() : sub.canceledAt,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "subscriptionInvoice",
    resourceId: invoice.id,
    diff: { number, amount: total.toString(), subscriptionId: sub.id },
  });
}

export async function changeInvoiceStatusAction(invoiceId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionInvoice", "edit");
  const status = s(fd, "status");
  if (!SUBSCRIPTION_INVOICE_STATUSES.includes(status as never)) throw new Error("Invalid status");
  const existing = await prisma.subscriptionInvoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Invoice not found");
  await prisma.subscriptionInvoice.update({
    where: { id: invoiceId },
    data: {
      status: status as (typeof SUBSCRIPTION_INVOICE_STATUSES)[number],
      paidAt: status === "PAID" ? new Date() : existing.paidAt,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "subscriptionInvoice",
    resourceId: invoiceId,
    diff: { status: { from: existing.status, to: status } },
  });
}
