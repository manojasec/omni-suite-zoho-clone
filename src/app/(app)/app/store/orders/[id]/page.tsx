import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  STORE_ORDER_STATUS_LABELS,
  STORE_ORDER_TRANSITIONS,
  formatMoney,
} from "@/modules/commerce/schemas";
import {
  addOrderItemAction,
  deleteOrderAction,
  removeOrderItemAction,
  transitionOrderAction,
  updateOrderItemAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function StoreOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "view");

  const order = await prisma.storeOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) notFound();

  const products = await prisma.product.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, taxPercent: true },
  });

  const canEdit = can(ctx.role, "storeOrder", "edit");
  const canManage = can(ctx.role, "storeOrder", "manage");
  const canDelete = can(ctx.role, "storeOrder", "delete");
  const editable = order.status === "PENDING";
  const transitions = STORE_ORDER_TRANSITIONS[order.status] ?? [];

  const transitionBound = transitionOrderAction.bind(null, order.id);
  const addItemBound = addOrderItemAction.bind(null, order.id);
  const deleteBound = deleteOrderAction.bind(null, order.id);

  const enrolledIds = new Set(order.items.map((i) => i.productId));
  const availableProducts = products.filter((p) => !enrolledIds.has(p.id));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Order #{order.number}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/store/customers/${order.customer.id}`}
              className="hover:underline"
            >
              {order.customer.name}
            </Link>{" "}
            · {order.customer.email} · {STORE_ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
        {canDelete && order.status !== "PAID" && order.status !== "FULFILLED" ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Subtotal</div>
          <div className="mt-1 text-xl font-semibold">
            {formatMoney(Number(order.subtotal), order.currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Tax</div>
          <div className="mt-1 text-xl font-semibold">
            {formatMoney(Number(order.tax), order.currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-xl font-semibold">
            {formatMoney(Number(order.total), order.currency)}
          </div>
        </Card>
      </div>

      {transitions.length > 0 ? (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm text-muted-foreground">Transition →</span>
          {transitions.map((t) => {
            const requiresManage = t === "REFUNDED";
            const allowed = requiresManage ? canManage : canEdit;
            if (!allowed) return null;
            return (
              <form key={t} action={transitionBound}>
                <input type="hidden" name="to" value={t} />
                <Button type="submit" size="sm" variant="outline">
                  {STORE_ORDER_STATUS_LABELS[t]}
                </Button>
              </form>
            );
          })}
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Line items</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 pr-2">Tax %</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2 text-right">Subtotal</th>
                  <th className="py-2 pr-2 text-right">Tax</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                  <th className="py-2 pr-0" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((it) => {
                  const updateBound = updateOrderItemAction.bind(null, it.id);
                  const removeBound = removeOrderItemAction.bind(null, it.id);
                  return (
                    <tr key={it.id}>
                      <td className="py-2 pr-2 font-medium">{it.nameSnapshot}</td>
                      <td className="py-2 pr-2">
                        {formatMoney(Number(it.unitPrice), order.currency)}
                      </td>
                      <td className="py-2 pr-2">{Number(it.taxPercent)}%</td>
                      <td className="py-2 pr-2">
                        {editable && canEdit ? (
                          <form action={updateBound} className="flex items-center gap-1">
                            <Input
                              name="quantity"
                              type="number"
                              min={1}
                              defaultValue={it.quantity}
                              className="w-20"
                            />
                            <Button type="submit" size="sm" variant="outline">
                              Save
                            </Button>
                          </form>
                        ) : (
                          it.quantity
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatMoney(Number(it.lineSubtotal), order.currency)}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {formatMoney(Number(it.lineTax), order.currency)}
                      </td>
                      <td className="py-2 pr-2 text-right font-medium">
                        {formatMoney(Number(it.lineTotal), order.currency)}
                      </td>
                      <td className="py-2 pr-0 text-right">
                        {editable && canEdit ? (
                          <form action={removeBound}>
                            <Button type="submit" size="sm" variant="ghost">
                              Remove
                            </Button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {editable && canEdit && availableProducts.length > 0 ? (
          <form
            action={addItemBound}
            className="mt-4 grid gap-2 border-t pt-4 md:grid-cols-[1fr_120px_auto]"
          >
            <div>
              <Label htmlFor="productId">Add product</Label>
              <Select id="productId" name="productId" required defaultValue="">
                <option value="" disabled>
                  Select a product…
                </option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(Number(p.price), order.currency)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Add</Button>
            </div>
          </form>
        ) : null}
      </Card>

      {order.notes ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
