import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { loadPortal } from "@/modules/portal/load";

export const dynamic = "force-dynamic";

export default async function PortalOverviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadPortal(token);

  const [invoiceCount, quoteCount, openInvoices] = await Promise.all([
    prisma.invoice.count({ where: { customerId: ctx.customer.id } }),
    prisma.quote.count({ where: { customerId: ctx.customer.id } }),
    prisma.invoice.findMany({
      where: {
        customerId: ctx.customer.id,
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
      },
      orderBy: { issueDate: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        currency: true,
        balance: true,
        dueDate: true,
        status: true,
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/portal/${token}/invoices`}>
          <Card className="p-4 hover:bg-accent/30">
            <p className="text-xs uppercase text-muted-foreground">Invoices</p>
            <p className="text-2xl font-semibold">{invoiceCount}</p>
          </Card>
        </Link>
        <Link href={`/portal/${token}/quotes`}>
          <Card className="p-4 hover:bg-accent/30">
            <p className="text-xs uppercase text-muted-foreground">Quotes</p>
            <p className="text-2xl font-semibold">{quoteCount}</p>
          </Card>
        </Link>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Outstanding invoices</h2>
        {openInvoices.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nothing outstanding. You&apos;re all caught up.
          </Card>
        ) : (
          <Card className="divide-y p-0">
            {openInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-mono">{inv.number}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.status}
                    {inv.dueDate
                      ? ` · due ${inv.dueDate.toISOString().slice(0, 10)}`
                      : ""}
                  </div>
                </div>
                <div className="font-semibold">
                  {inv.currency} {Number(inv.balance).toFixed(2)}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
