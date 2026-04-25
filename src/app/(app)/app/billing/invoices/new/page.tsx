import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "../invoice-form";
import { createInvoiceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;

  const customers = await prisma.customer.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, currency: true },
  });

  if (customers.length === 0) {
    redirect("/app/billing/customers/new");
  }

  const customerId = sp.customerId && customers.some((c) => c.id === sp.customerId)
    ? sp.customerId
    : customers[0].id;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">A unique invoice number is generated automatically.</p>
      </div>
      <InvoiceForm
        action={createInvoiceAction}
        initial={{ customerId, currency: "USD" }}
        customers={customers}
        submitLabel="Create invoice"
      />
    </div>
  );
}
