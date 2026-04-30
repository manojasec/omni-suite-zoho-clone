import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { loadPortal } from "@/modules/portal/load";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadPortal(token);

  const invoices = await prisma.invoice.findMany({
    where: { customerId: ctx.customer.id },
    orderBy: { issueDate: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      total: true,
      balance: true,
      issueDate: true,
      dueDate: true,
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Invoices</h2>
      {invoices.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No invoices yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="rounded bg-muted px-2 py-0.5 text-xs">
                {inv.status}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono">{inv.number}</div>
                <div className="text-xs text-muted-foreground">
                  issued {inv.issueDate.toISOString().slice(0, 10)}
                  {inv.dueDate
                    ? ` · due ${inv.dueDate.toISOString().slice(0, 10)}`
                    : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {inv.currency} {Number(inv.total).toFixed(2)}
                </div>
                {Number(inv.balance) > 0 ? (
                  <div className="text-xs text-amber-700">
                    balance {inv.currency} {Number(inv.balance).toFixed(2)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
