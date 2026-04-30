import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../customer-form";
import { updateCustomerAction, deleteCustomerAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();

  const [customer, companies, invoices] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { company: true },
    }),
    prisma.company.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.invoice.findMany({
      where: { workspaceId: ctx.workspaceId, customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  if (!customer) notFound();

  const update = updateCustomerAction.bind(null, id);
  const remove = deleteCustomerAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/billing/customers" className="text-sm text-muted-foreground hover:underline">
            ← All customers
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{customer.name}</h1>
          {customer.email ? <p className="text-sm text-muted-foreground">{customer.email}</p> : null}
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <div>
        <Link
          href={`/app/billing/customers/${id}/portal`}
          className="text-sm underline"
        >
          Manage portal links →
        </Link>
      </div>

      <CustomerForm
        action={update}
        initial={customer}
        companies={companies}
        submitLabel="Save changes"
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoices ({invoices.length})</CardTitle>
          <Link href={`/app/billing/invoices/new?customerId=${customer.id}`}>
            <Button size="sm" variant="outline">New invoice</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <ul className="divide-y">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2">
                  <Link href={`/app/billing/invoices/${inv.id}`} className="text-sm hover:underline">
                    {inv.number}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {Number(inv.total).toLocaleString()} {inv.currency} · {inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
