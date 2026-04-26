import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_INVOICE_STATUSES } from "@/modules/subscriptions/schemas";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionInvoice", "view");
  const sp = await searchParams;
  const status = SUBSCRIPTION_INVOICE_STATUSES.includes(sp.status as never) ? (sp.status as (typeof SUBSCRIPTION_INVOICE_STATUSES)[number]) : undefined;
  const q = (sp.q ?? "").trim();
  const invoices = await prisma.subscriptionInvoice.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
      ...(q ? { number: { contains: q } } : {}),
    },
    orderBy: { issuedAt: "desc" },
    include: { subscription: { select: { id: true, customerName: true, customerEmail: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <Link href="/app/subscriptions" className="text-xs text-muted-foreground hover:underline">← Subscriptions</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Subscription invoices</h1>
      <Card className="p-3">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Search invoice number..." className="flex-1" />
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {SUBSCRIPTION_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Button type="submit" variant="outline">Filter</Button>
        </form>
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Number</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Issued</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((iv) => (
              <tr key={iv.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-xs">{iv.number}</td>
                <td className="px-3 py-2">
                  <Link href={`/app/subscriptions/${iv.subscription.id}`} className="hover:underline">{iv.subscription.customerName}</Link>
                  <div className="text-xs text-muted-foreground">{iv.subscription.customerEmail}</div>
                </td>
                <td className="px-3 py-2 text-right">{iv.currency} {Number(iv.amount).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs">{iv.status}</td>
                <td className="px-3 py-2 text-muted-foreground">{iv.issuedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {invoices.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No invoices match.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
