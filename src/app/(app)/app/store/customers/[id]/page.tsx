import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  STORE_ORDER_STATUS_LABELS,
  formatMoney,
} from "@/modules/commerce/schemas";
import {
  deleteStoreCustomerAction,
  updateStoreCustomerAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function StoreCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "view");

  const customer = await prisma.storeCustomer.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });
  if (!customer) notFound();

  const canEdit = can(ctx.role, "storeCustomer", "edit");
  const canDelete = can(ctx.role, "storeCustomer", "delete");

  const updateBound = updateStoreCustomerAction.bind(null, customer.id);
  const deleteBound = deleteStoreCustomerAction.bind(null, customer.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {customer.name}
          </h1>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        </div>
        {canDelete ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <form action={updateBound} className="grid gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer.email}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={customer.name}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={customer.phone ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="shippingAddress">Shipping address</Label>
              <Textarea
                id="shippingAddress"
                name="shippingAddress"
                rows={3}
                defaultValue={customer.shippingAddress ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={customer.notes ?? ""}
                disabled={!canEdit}
              />
            </div>
            {canEdit ? (
              <div className="flex justify-end">
                <Button type="submit">Save</Button>
              </div>
            ) : null}
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Order history</h2>
          {customer.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {customer.orders.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={`/app/store/orders/${o.id}`}
                    className="hover:underline"
                  >
                    Order #{o.number}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {STORE_ORDER_STATUS_LABELS[o.status]} ·{" "}
                    {formatMoney(Number(o.total), o.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
