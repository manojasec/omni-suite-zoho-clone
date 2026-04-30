import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createQuoteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; dealId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "quote", "create");

  const customers = await prisma.customer.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, currency: true },
  });

  if (customers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">New quote</h1>
        <Card className="p-6 text-sm">
          You need a customer before creating a quote.{" "}
          <Link href="/app/billing/customers" className="underline">
            Add one first
          </Link>
          .
        </Card>
      </div>
    );
  }

  const presetCustomer =
    sp.customerId && customers.some((c) => c.id === sp.customerId)
      ? sp.customerId
      : customers[0].id;

  return (
    <div className="space-y-4">
      <p>
        <Link href="/app/quotes" className="text-xs text-muted-foreground hover:underline">
          ← Quotes
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">New quote</h1>

      <form action={createQuoteAction} className="space-y-4">
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="customerId">Customer</Label>
              <Select id="customerId" name="customerId" defaultValue={presetCustomer} required>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={8} />
            </div>
            <div>
              <Label htmlFor="expiresAt">Expires</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
          </div>
          {sp.dealId ? <input type="hidden" name="dealId" value={sp.dealId} /> : null}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
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
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2">
                    <Input name="line.description" placeholder="Item description" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      name="line.qty"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={i === 0 ? "1" : ""}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input name="line.unitPrice" type="number" step="0.01" min="0" />
                  </td>
                  <td className="py-1">
                    <Input
                      name="line.taxPercent"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Empty rows are ignored. Totals are computed on save.
          </p>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Create quote</Button>
        </div>
      </form>
    </div>
  );
}
