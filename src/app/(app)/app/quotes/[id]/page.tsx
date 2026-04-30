import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  canTransitionQuote,
  formatQuoteStatus,
  quoteStatusColor,
  type QuoteStatus,
} from "@/modules/quotes/schemas";
import {
  acceptQuoteAction,
  convertQuoteToInvoiceAction,
  deleteQuoteAction,
  rejectQuoteAction,
  sendQuoteAction,
  updateQuoteAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "view");
  const canEdit = can(ctx.role, "quote", "edit");
  const canSend = can(ctx.role, "quote", "send");
  const canDelete = can(ctx.role, "quote", "delete");
  const canConvert =
    can(ctx.role, "quote", "edit") && can(ctx.role, "invoice", "create");

  const [quote, customers] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        customer: { select: { id: true, name: true } },
        lineItems: { orderBy: { position: "asc" } },
      },
    }),
    prisma.customer.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true },
    }),
  ]);
  if (!quote) notFound();

  const status = quote.status as QuoteStatus;
  const editable = status !== "CONVERTED" && status !== "REJECTED";

  return (
    <div className="space-y-4">
      <p>
        <Link href="/app/quotes" className="text-xs text-muted-foreground hover:underline">
          ← Quotes
        </Link>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${quoteStatusColor(status)}`}
            >
              {formatQuoteStatus(status)}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{quote.number}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote.customer.name} · issued{" "}
            {quote.issueDate.toISOString().slice(0, 10)}
            {quote.expiresAt
              ? ` · expires ${quote.expiresAt.toISOString().slice(0, 10)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend && canTransitionQuote(status, "SENT") ? (
            <form action={sendQuoteAction.bind(null, quote.id)}>
              <Button type="submit" size="sm">
                Mark as sent
              </Button>
            </form>
          ) : null}
          {canEdit && canTransitionQuote(status, "ACCEPTED") ? (
            <form action={acceptQuoteAction.bind(null, quote.id)}>
              <Button type="submit" size="sm" variant="outline">
                Accept
              </Button>
            </form>
          ) : null}
          {canEdit && canTransitionQuote(status, "REJECTED") ? (
            <form action={rejectQuoteAction.bind(null, quote.id)}>
              <Button type="submit" size="sm" variant="ghost">
                Reject
              </Button>
            </form>
          ) : null}
          {canConvert && canTransitionQuote(status, "CONVERTED") ? (
            <form action={convertQuoteToInvoiceAction.bind(null, quote.id)}>
              <Button type="submit" size="sm">
                Convert to invoice
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {quote.invoiceId ? (
        <Card className="p-3 text-xs">
          Converted to{" "}
          <Link href={`/app/billing/invoices/${quote.invoiceId}`} className="font-mono underline">
            invoice
          </Link>
          .
        </Card>
      ) : null}

      <form action={updateQuoteAction.bind(null, quote.id)} className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="customerId">Customer</Label>
              <Select
                id="customerId"
                name="customerId"
                defaultValue={quote.customerId}
                required
                disabled={!canEdit || !editable}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={quote.currency}
                maxLength={8}
                disabled={!canEdit || !editable}
              />
            </div>
            <div>
              <Label htmlFor="expiresAt">Expires</Label>
              <Input
                id="expiresAt"
                name="expiresAt"
                type="date"
                defaultValue={
                  quote.expiresAt ? quote.expiresAt.toISOString().slice(0, 10) : ""
                }
                disabled={!canEdit || !editable}
              />
            </div>
          </div>
          {quote.dealId ? (
            <input type="hidden" name="dealId" value={quote.dealId} />
          ) : null}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={quote.notes ?? ""}
              disabled={!canEdit || !editable}
            />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Line items</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2">Description</th>
                <th className="pb-2 w-24">Qty</th>
                <th className="pb-2 w-32">Unit price</th>
                <th className="pb-2 w-24">Tax %</th>
                <th className="pb-2 w-32 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...quote.lineItems, ...Array(Math.max(0, 6 - quote.lineItems.length)).fill(null)].map(
                (ln, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="py-1 pr-2">
                      <Input
                        name="line.description"
                        defaultValue={ln?.description ?? ""}
                        disabled={!canEdit || !editable}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        name="line.qty"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={ln ? Number(ln.qty).toString() : ""}
                        disabled={!canEdit || !editable}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        name="line.unitPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={ln ? Number(ln.unitPrice).toString() : ""}
                        disabled={!canEdit || !editable}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        name="line.taxPercent"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={ln ? Number(ln.taxPercent).toString() : "0"}
                        disabled={!canEdit || !editable}
                      />
                    </td>
                    <td className="py-1 text-right text-xs text-muted-foreground">
                      {ln ? Number(ln.amount).toFixed(2) : ""}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {quote.currency} {Number(quote.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>
                {quote.currency} {Number(quote.tax).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span>
                {quote.currency} {Number(quote.total).toFixed(2)}
              </span>
            </div>
          </div>
        </Card>

        {canEdit && editable ? (
          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        ) : null}
      </form>

      {canDelete && status !== "CONVERTED" ? (
        <Card className="p-4">
          <form action={deleteQuoteAction.bind(null, quote.id)}>
            <Button type="submit" variant="ghost">
              Delete quote
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
