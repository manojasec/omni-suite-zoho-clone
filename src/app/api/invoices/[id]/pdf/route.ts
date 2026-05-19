import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { renderInvoicePdf } from "@/platform/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireSession();
  const invoice = await prisma.invoice.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      lineItems: true,
      customer: true,
      workspace: { select: { name: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdf = renderInvoicePdf({
    workspaceName: invoice.workspace.name,
    invoiceNumber: invoice.number,
    status: invoice.status,
    issuedAt: invoice.issueDate,
    dueAt: invoice.dueDate,
    customer: {
      name: invoice.customer.name,
      email: invoice.customer.email,
      address: invoice.customer.billingAddress,
    },
    currency: invoice.currency,
    lines: invoice.lineItems.map((l) => ({
      description: l.description,
      quantity: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      total: Number(l.amount),
    })),
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    notes: invoice.notes,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
