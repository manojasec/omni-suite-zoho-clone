import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  QUOTE_STATUSES,
  formatQuoteStatus,
  quoteStatusColor,
  type QuoteStatus,
} from "@/modules/quotes/schemas";

export const dynamic = "force-dynamic";

export default async function QuotesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "view");
  const canCreate = can(ctx.role, "quote", "create");

  const sp = await searchParams;
  const status =
    sp.status && (QUOTE_STATUSES as readonly string[]).includes(sp.status)
      ? (sp.status as QuoteStatus)
      : undefined;

  const [quotes, counts] = await Promise.all([
    prisma.quote.findMany({
      where: { workspaceId: ctx.workspaceId, ...(status ? { status } : {}) },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        status: true,
        currency: true,
        total: true,
        issueDate: true,
        expiresAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.quote.groupBy({
      by: ["status"],
      where: { workspaceId: ctx.workspaceId },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Send proposals to customers. Accepted quotes can be converted to invoices.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/quotes/new">
            <Button>New quote</Button>
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href="/app/quotes"
          className={`rounded border px-2 py-1 ${!status ? "bg-accent" : "hover:bg-accent/50"}`}
        >
          All
        </Link>
        {QUOTE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/quotes?status=${s}`}
            className={`rounded border px-2 py-1 ${status === s ? "bg-accent" : "hover:bg-accent/50"}`}
          >
            {formatQuoteStatus(s)} ({countByStatus.get(s) ?? 0})
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No quotes yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {quotes.map((q) => (
            <Link
              key={q.id}
              href={`/app/quotes/${q.id}`}
              className="block p-4 hover:bg-muted/50"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${quoteStatusColor(q.status as QuoteStatus)}`}
                >
                  {formatQuoteStatus(q.status as QuoteStatus)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{q.number}</div>
                  <p className="text-xs text-muted-foreground">
                    {q.customer.name} · issued{" "}
                    {q.issueDate.toISOString().slice(0, 10)}
                    {q.expiresAt
                      ? ` · expires ${q.expiresAt.toISOString().slice(0, 10)}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold">
                  {q.currency} {Number(q.total).toFixed(2)}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
