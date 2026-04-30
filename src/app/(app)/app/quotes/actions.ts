"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  canTransitionQuote,
  computeQuoteTotals,
  nextQuoteNumber,
  quoteHeaderSchema,
  quoteLineSchema,
  type QuoteStatus,
} from "@/modules/quotes/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

function parseLines(fd: FormData): {
  description: string;
  qty: number;
  unitPrice: number;
  taxPercent: number;
}[] {
  const descriptions = fd.getAll("line.description").map(String);
  const qtys = fd.getAll("line.qty").map(String);
  const unitPrices = fd.getAll("line.unitPrice").map(String);
  const taxes = fd.getAll("line.taxPercent").map(String);
  const out: ReturnType<typeof parseLines> = [];
  for (let i = 0; i < descriptions.length; i += 1) {
    const description = descriptions[i]?.trim();
    if (!description) continue;
    const parsed = quoteLineSchema.safeParse({
      description,
      qty: qtys[i] ?? "1",
      unitPrice: unitPrices[i] ?? "0",
      taxPercent: taxes[i] ?? "0",
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid line item");
    }
    out.push(parsed.data);
  }
  return out;
}

async function generateNumber(workspaceId: string): Promise<string> {
  const recent = await prisma.quote.findMany({
    where: { workspaceId },
    select: { number: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return nextQuoteNumber(recent.map((r) => r.number));
}

export async function createQuoteAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "create");

  const header = quoteHeaderSchema.parse({
    customerId: s(fd, "customerId"),
    dealId: s(fd, "dealId"),
    currency: s(fd, "currency") || "USD",
    expiresAt: s(fd, "expiresAt"),
    notes: s(fd, "notes"),
  });

  const customer = await prisma.customer.findFirst({
    where: { id: header.customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");

  const lines = parseLines(fd);
  if (lines.length === 0) throw new Error("Add at least one line item");

  const totals = computeQuoteTotals(lines);
  const number = await generateNumber(ctx.workspaceId);

  const created = await prisma.quote.create({
    data: {
      workspaceId: ctx.workspaceId,
      number,
      customerId: header.customerId,
      dealId: header.dealId || null,
      currency: header.currency,
      expiresAt: header.expiresAt ? new Date(header.expiresAt) : null,
      notes: header.notes || null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      lineItems: {
        create: lines.map((ln, i) => ({
          description: ln.description,
          qty: ln.qty,
          unitPrice: ln.unitPrice,
          taxPercent: ln.taxPercent,
          amount: ln.qty * ln.unitPrice,
          position: i,
        })),
      },
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "quote.create",
    resource: "quote",
    resourceId: created.id,
    diff: { number, total: totals.total, currency: header.currency },
  });

  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${created.id}`);
}

export async function updateQuoteAction(quoteId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "edit");

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Quote not found");
  if (existing.status === "CONVERTED" || existing.status === "REJECTED") {
    throw new Error("Cannot edit a finalized quote");
  }

  const header = quoteHeaderSchema.parse({
    customerId: s(fd, "customerId"),
    dealId: s(fd, "dealId"),
    currency: s(fd, "currency") || "USD",
    expiresAt: s(fd, "expiresAt"),
    notes: s(fd, "notes"),
  });

  const customer = await prisma.customer.findFirst({
    where: { id: header.customerId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!customer) throw new Error("Customer not found");

  const lines = parseLines(fd);
  if (lines.length === 0) throw new Error("Add at least one line item");

  const totals = computeQuoteTotals(lines);

  await prisma.$transaction([
    prisma.quoteLineItem.deleteMany({ where: { quoteId } }),
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        customerId: header.customerId,
        dealId: header.dealId || null,
        currency: header.currency,
        expiresAt: header.expiresAt ? new Date(header.expiresAt) : null,
        notes: header.notes || null,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        lineItems: {
          create: lines.map((ln, i) => ({
            description: ln.description,
            qty: ln.qty,
            unitPrice: ln.unitPrice,
            taxPercent: ln.taxPercent,
            amount: ln.qty * ln.unitPrice,
            position: i,
          })),
        },
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "quote.update",
    resource: "quote",
    resourceId: quoteId,
    diff: { total: totals.total },
  });

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
}

async function transitionQuote(
  quoteId: string,
  to: QuoteStatus,
  action: string,
  permission: "edit" | "send",
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", permission);

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Quote not found");
  if (!canTransitionQuote(existing.status as QuoteStatus, to)) {
    throw new Error(`Cannot move from ${existing.status} to ${to}`);
  }

  const now = new Date();
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: to,
      acceptedAt: to === "ACCEPTED" ? now : undefined,
      rejectedAt: to === "REJECTED" ? now : undefined,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action,
    resource: "quote",
    resourceId: quoteId,
    diff: { from: existing.status, to },
  });

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
}

export async function sendQuoteAction(quoteId: string) {
  await transitionQuote(quoteId, "SENT", "quote.send", "send");
}

export async function acceptQuoteAction(quoteId: string) {
  await transitionQuote(quoteId, "ACCEPTED", "quote.accept", "edit");
}

export async function rejectQuoteAction(quoteId: string) {
  await transitionQuote(quoteId, "REJECTED", "quote.reject", "edit");
}

export async function convertQuoteToInvoiceAction(quoteId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "edit");
  assertCan(ctx.role, "invoice", "create");

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, workspaceId: ctx.workspaceId },
    include: { lineItems: { orderBy: { position: "asc" } } },
  });
  if (!quote) throw new Error("Quote not found");
  if (!canTransitionQuote(quote.status as QuoteStatus, "CONVERTED")) {
    throw new Error("Quote must be ACCEPTED before conversion");
  }
  if (quote.invoiceId) throw new Error("Quote already converted");

  // Generate next invoice number using the same pattern as the invoices module.
  const recent = await prisma.invoice.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { number: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const max = recent
    .map((r) => Number.parseInt(/(\d+)$/.exec(r.number)?.[1] ?? "0", 10))
    .reduce((a, b) => Math.max(a, b), 0);
  const invoiceNumber = `INV-${String(max + 1).padStart(4, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      number: invoiceNumber,
      customerId: quote.customerId,
      dealId: quote.dealId,
      status: "DRAFT",
      currency: quote.currency,
      subtotal: quote.subtotal,
      tax: quote.tax,
      total: quote.total,
      balance: quote.total,
      notes: quote.notes,
      lineItems: {
        create: quote.lineItems.map((ln) => ({
          description: ln.description,
          qty: ln.qty,
          unitPrice: ln.unitPrice,
          taxPercent: ln.taxPercent,
          amount: ln.amount,
        })),
      },
    },
    select: { id: true },
  });

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: "CONVERTED",
      convertedAt: new Date(),
      invoiceId: invoice.id,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "quote.convert",
    resource: "quote",
    resourceId: quoteId,
    diff: { invoiceId: invoice.id, invoiceNumber },
  });

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/billing/invoices");
  redirect(`/app/billing/invoices/${invoice.id}`);
}

export async function deleteQuoteAction(quoteId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "delete");

  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true },
  });
  if (!existing) throw new Error("Quote not found");
  if (existing.status === "CONVERTED") {
    throw new Error("Cannot delete a converted quote");
  }

  await prisma.quote.delete({ where: { id: quoteId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "quote.delete",
    resource: "quote",
    resourceId: quoteId,
  });

  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}
