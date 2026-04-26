import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createStoreCustomerAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewStoreCustomerPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "create");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
        <p className="text-sm text-muted-foreground">
          Capture a buyer's contact and shipping details.
        </p>
      </div>

      <Card className="p-4">
        <form action={createStoreCustomerAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="shippingAddress">Shipping address</Label>
            <Textarea id="shippingAddress" name="shippingAddress" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create customer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
