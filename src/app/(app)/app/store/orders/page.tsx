import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  STORE_ORDER_STATUS_LABELS,
  formatMoney,
} from "@/modules/commerce/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-zinc-100 text-zinc-700",
  REFUNDED: "bg-rose-100 text-rose-700",
};

export default async function StoreOrdersPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeOrder", "view");

  const orders = await prisma.storeOrder.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { number: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
  const canCreate = can(ctx.role, "storeOrder", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Storefront orders from PENDING through PAID, FULFILLED, REFUNDED.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/store/orders/new">
            <Button>New order</Button>
          </Link>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No orders yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/store/orders/${o.id}`}
                  className="font-medium hover:underline"
                >
                  Order #{o.number}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {o.customer.name} · {o.customer.email} · {o._count.items} item
                  {o._count.items === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {formatMoney(Number(o.total), o.currency)}
                </span>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[o.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {STORE_ORDER_STATUS_LABELS[o.status]}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
