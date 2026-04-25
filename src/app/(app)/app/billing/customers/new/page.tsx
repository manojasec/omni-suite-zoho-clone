import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CustomerForm } from "../customer-form";
import { createCustomerAction } from "../actions";

export default async function NewCustomerPage() {
  const ctx = await requireSession();
  const companies = await prisma.company.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
        <p className="text-sm text-muted-foreground">Customers receive invoices in your billing module.</p>
      </div>
      <CustomerForm action={createCustomerAction} companies={companies} submitLabel="Create customer" />
    </div>
  );
}
