import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { loadPortal } from "@/modules/portal/load";
import {
  formatQuoteStatus,
  quoteStatusColor,
  type QuoteStatus,
} from "@/modules/quotes/schemas";

export const dynamic = "force-dynamic";

export default async function PortalQuotesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadPortal(token);

  const quotes = await prisma.quote.findMany({
    where: { customerId: ctx.customer.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      currency: true,
      total: true,
      issueDate: true,
      expiresAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Quotes</h2>
      {quotes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No quotes yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {quotes.map((q) => (
            <div key={q.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${quoteStatusColor(q.status as QuoteStatus)}`}
              >
                {formatQuoteStatus(q.status as QuoteStatus)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono">{q.number}</div>
                <div className="text-xs text-muted-foreground">
                  issued {q.issueDate.toISOString().slice(0, 10)}
                  {q.expiresAt
                    ? ` · expires ${q.expiresAt.toISOString().slice(0, 10)}`
                    : ""}
                </div>
              </div>
              <div className="text-right font-semibold">
                {q.currency} {Number(q.total).toFixed(2)}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
