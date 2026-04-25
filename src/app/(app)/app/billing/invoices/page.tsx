import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALL_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.VOID,
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status && ALL_STATUSES.includes(sp.status as InvoiceStatus)
    ? (sp.status as InvoiceStatus)
    : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q } },
              { customer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const totalsByStatus = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] ?? 0) + Number(inv.total);
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {invoices.length} shown · open {(totalsByStatus.SENT ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} · paid {(totalsByStatus.PAID ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <Link href="/app/billing/invoices/new">
          <Button><Plus className="h-4 w-4" /> New invoice</Button>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by number or customer" className="pl-8" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <FilterChip current={status} value={undefined} label="All" />
          {ALL_STATUSES.map((s) => (
            <FilterChip key={s} current={status} value={s} label={s} />
          ))}
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Balance</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2 text-left">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No invoices match this filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/billing/invoices/${inv.id}`} className="font-medium hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{inv.customer.name}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(inv.total).toLocaleString()} {inv.currency}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(inv.balance).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cls =
    status === "PAID"
      ? "bg-green-100 text-green-900"
      : status === "OVERDUE"
      ? "bg-red-100 text-red-900"
      : status === "VOID"
      ? "bg-zinc-200 text-zinc-700"
      : status === "SENT" || status === "PARTIALLY_PAID"
      ? "bg-blue-100 text-blue-900"
      : "bg-secondary";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

function FilterChip({
  current, value, label,
}: { current?: InvoiceStatus; value?: InvoiceStatus; label: string }) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value) params.set("status", value);
  return (
    <Link
      href={`/app/billing/invoices${params.toString() ? `?${params}` : ""}`}
      className={`whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}
