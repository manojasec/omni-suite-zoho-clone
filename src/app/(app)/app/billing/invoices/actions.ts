"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import {
  invoiceSchema,
  paymentSchema,
  invoiceStatusSchema,
  type LineItemInput,
} from "@/modules/billing/schemas";
import { computeTotals, lineAmount } from "@/modules/billing/totals";
import { notifyUsers } from "@/modules/notifications/notify";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";

function parseLineItems(fd: FormData): LineItemInput[] {
  const descriptions = fd.getAll("li_description");
  const qtys = fd.getAll("li_qty");
  const unitPrices = fd.getAll("li_unitPrice");
  const taxes = fd.getAll("li_taxPercent");
  const items: { description: string; qty: string; unitPrice: string; taxPercent: string }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = String(descriptions[i] ?? "").trim();
    if (!description) continue;
    items.push({
      description,
      qty: String(qtys[i] ?? "1"),
      unitPrice: String(unitPrices[i] ?? "0"),
      taxPercent: String(taxes[i] ?? "0"),
    });
  }
  return items as unknown as LineItemInput[];
}

function fdToObj(fd: FormData) {
  return {
    customerId: fd.get("customerId") ?? "",
    dealId: fd.get("dealId") ?? "",
    projectId: fd.get("projectId") ?? "",
    number: fd.get("number") ?? "",
    issueDate: fd.get("issueDate") ?? "",
    dueDate: fd.get("dueDate") ?? "",
    currency: (fd.get("currency") as string) || "USD",
    notes: fd.get("notes") ?? "",
    lineItems: parseLineItems(fd),
  };
}

async function nextInvoiceNumber(workspaceId: string): Promise<string> {
  const count = await prisma.invoice.count({ where: { workspaceId } });
  return `INV-${String(count + 1).padStart(5, "0")}`;
}

function recomputeBalance(total: string, payments: { amount: Prisma.Decimal | string | number }[]) {
  const paid = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const balance = Math.max(0, Number(total) - paid);
  return { paid: paid.toFixed(2), balance: balance.toFixed(2) };
}

export async function createInvoiceAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "invoice", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "invoices");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const parsed = invoiceSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) return { error: "Customer not found" };

  const totals = computeTotals(data.lineItems);

  let attempt = 0;
  let invoiceId: string | null = null;
  while (attempt < 5) {
    const number = data.number || (await nextInvoiceNumber(ctx.workspaceId));
    try {
      const created = await prisma.invoice.create({
        data: {
          workspaceId: ctx.workspaceId,
          number,
          customerId: data.customerId,
          dealId: data.dealId,
          projectId: data.projectId,
          status: InvoiceStatus.DRAFT,
          issueDate: data.issueDate,
          dueDate: data.dueDate ?? null,
          currency: data.currency,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          balance: totals.total,
          notes: data.notes,
          lineItems: {
            create: data.lineItems.map((li) => ({
              description: li.description,
              qty: li.qty,
              unitPrice: li.unitPrice,
              taxPercent: li.taxPercent,
              amount: lineAmount(li),
            })),
          },
        },
      });
      invoiceId = created.id;
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        attempt++;
        continue;
      }
      throw e;
    }
  }
  if (!invoiceId) return { error: "Could not allocate invoice number — please retry" };

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "invoice",
      resourceId: invoiceId,
    },
  });
  revalidatePath("/app/billing/invoices");
  redirect(`/app/billing/invoices/${invoiceId}`);
}

export async function updateInvoiceAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "invoice", "edit");
  const parsed = invoiceSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { payments: { select: { amount: true } } },
  });
  if (!existing) return { error: "Not found" };
  if (existing.status === InvoiceStatus.PAID || existing.status === InvoiceStatus.VOID) {
    return { error: "Cannot edit a paid or voided invoice" };
  }

  const totals = computeTotals(data.lineItems);
  const { balance } = recomputeBalance(totals.total, existing.payments);

  await prisma.$transaction([
    prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: {
        customerId: data.customerId,
        dealId: data.dealId,
        projectId: data.projectId,
        issueDate: data.issueDate,
        dueDate: data.dueDate ?? null,
        currency: data.currency,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        balance,
        notes: data.notes,
        lineItems: {
          create: data.lineItems.map((li) => ({
            description: li.description,
            qty: li.qty,
            unitPrice: li.unitPrice,
            taxPercent: li.taxPercent,
            amount: lineAmount(li),
          })),
        },
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "invoice",
      resourceId: id,
    },
  });
  revalidatePath(`/app/billing/invoices/${id}`);
  revalidatePath("/app/billing/invoices");
  return { ok: true };
}

export async function setInvoiceStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "invoice", "edit");
  const parsed = invoiceStatusSchema.safeParse({ status: fd.get("status") });
  if (!parsed.success) return { error: "Invalid status" };

  const existing = await prisma.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };

  await prisma.invoice.update({ where: { id }, data: { status: parsed.data.status } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "status:" + parsed.data.status.toLowerCase(),
      resource: "invoice",
      resourceId: id,
    },
  });
  revalidatePath(`/app/billing/invoices/${id}`);
  revalidatePath("/app/billing/invoices");
  return { ok: true };
}

export async function recordPaymentAction(invoiceId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "invoice", "edit");
  const parsed = paymentSchema.safeParse({
    amount: fd.get("amount") ?? "0",
    method: fd.get("method") ?? "",
    reference: fd.get("reference") ?? "",
    paidAt: fd.get("paidAt") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
    include: { payments: { select: { amount: true } } },
  });
  if (!invoice) return { error: "Not found" };
  if (invoice.status === InvoiceStatus.VOID) return { error: "Cannot pay a voided invoice" };

  const newPayments = [...invoice.payments, { amount: data.amount }];
  const { balance } = recomputeBalance(invoice.total.toString(), newPayments);
  const newStatus =
    Number(balance) === 0
      ? InvoiceStatus.PAID
      : Number(balance) < Number(invoice.total)
      ? InvoiceStatus.PARTIALLY_PAID
      : invoice.status;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { balance, status: newStatus },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "payment",
      resource: "invoice",
      resourceId: invoiceId,
      diff: { amount: data.amount, method: data.method },
    },
  });
  if (newStatus === InvoiceStatus.PAID && invoice.status !== InvoiceStatus.PAID) {
    const owners = await prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId, role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    });
    await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: owners.map((m) => m.userId),
      type: "invoice.paid",
      title: `Invoice ${invoice.number} paid`,
      href: `/app/billing/invoices/${invoiceId}`,
      meta: { amount: data.amount.toString(), invoiceId },
    });
  }
  revalidatePath(`/app/billing/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteInvoiceAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "invoice", "delete");
  const existing = await prisma.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) return;
  if (existing.status === InvoiceStatus.PAID) return;
  await prisma.invoice.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "invoice",
      resourceId: id,
    },
  });
  revalidatePath("/app/billing/invoices");
  redirect("/app/billing/invoices");
}
