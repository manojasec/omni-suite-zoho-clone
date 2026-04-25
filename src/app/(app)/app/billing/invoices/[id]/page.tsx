import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "../invoice-form";
import { updateInvoiceAction, deleteInvoiceAction } from "../actions";
import { InvoiceActions } from "../invoice-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();

  const [invoice, customers] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        customer: true,
        lineItems: true,
        payments: { orderBy: { paidAt: "desc" } },
      },
    }),
    prisma.customer.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, currency: true },
    }),
  ]);
  if (!invoice) notFound();

  const update = updateInvoiceAction.bind(null, id);
  const remove = deleteInvoiceAction.bind(null, id);
  const editable = invoice.status !== "PAID" && invoice.status !== "VOID";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/billing/invoices" className="text-sm text-muted-foreground hover:underline">
            ← All invoices
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.customer.name} · {Number(invoice.total).toLocaleString()} {invoice.currency} · {invoice.status}
          </p>
        </div>
        {invoice.status !== "PAID" ? (
          <form action={remove}>
            <Button type="submit" variant="destructive" size="sm">Delete</Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        {editable ? (
          <InvoiceForm
            action={update}
            initial={{
              customerId: invoice.customerId,
              number: invoice.number,
              issueDate: invoice.issueDate.toISOString(),
              dueDate: invoice.dueDate?.toISOString() ?? null,
              currency: invoice.currency,
              notes: invoice.notes,
              lineItems: invoice.lineItems.map((li) => ({
                description: li.description,
                qty: li.qty.toString(),
                unitPrice: li.unitPrice.toString(),
                taxPercent: li.taxPercent.toString(),
              })),
            }}
            customers={customers}
            submitLabel="Save changes"
            numberLocked={invoice.status !== "DRAFT"}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                This invoice is {invoice.status} and cannot be edited.
              </p>
              <table className="mt-4 w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit</th>
                    <th className="py-2 text-right">Tax %</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((li) => (
                    <tr key={li.id} className="border-b">
                      <td className="py-2">{li.description}</td>
                      <td className="py-2 text-right">{li.qty.toString()}</td>
                      <td className="py-2 text-right">{li.unitPrice.toString()}</td>
                      <td className="py-2 text-right">{li.taxPercent.toString()}</td>
                      <td className="py-2 text-right tabular-nums">{li.amount.toString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="text-sm">
                  <tr>
                    <td colSpan={4} className="py-2 text-right font-medium">Subtotal</td>
                    <td className="py-2 text-right tabular-nums">{invoice.subtotal.toString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="py-2 text-right font-medium">Tax</td>
                    <td className="py-2 text-right tabular-nums">{invoice.tax.toString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="py-2 text-right font-semibold">Total</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{invoice.total.toString()}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            balance={invoice.balance.toString()}
            currency={invoice.currency}
          />

          <Card>
            <CardHeader><CardTitle>Payments ({invoice.payments.length})</CardTitle></CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <ul className="divide-y">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className="py-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium tabular-nums">
                          {Number(p.amount).toLocaleString()} {invoice.currency}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.method}{p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
