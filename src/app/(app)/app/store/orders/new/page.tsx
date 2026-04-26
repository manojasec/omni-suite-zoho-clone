import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { createOrderAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "create");

  const customers = await prisma.storeCustomer.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  const storefront = await prisma.storefront.findFirst({
    where: { workspaceId: ctx.workspaceId },
    select: { currency: true },
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New order</h1>
        <p className="text-sm text-muted-foreground">
          Pick a customer to start a PENDING order, then add items on the next screen.
        </p>
      </div>

      <Card className="p-4">
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create a customer first before placing an order.
          </p>
        ) : (
          <form action={createOrderAction} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="customerId">Customer</Label>
              <Select id="customerId" name="customerId" required defaultValue="">
                <option value="" disabled>
                  Select a customer…
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                maxLength={3}
                defaultValue={storefront?.currency ?? "USD"}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Create order</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
