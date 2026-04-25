import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import PurchaseOrderForm from "./po-form";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const ctx = await requireSession();
  const [orders, suppliers, items, warehouses] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { name: true } } },
      take: 100,
    }),
    prisma.supplier.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryItem.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
    prisma.warehouse.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const canCreate = can(ctx.role, "purchaseOrder", "create");

  const statusColor: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    PARTIAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
        <p className="text-sm text-muted-foreground">
          Buy stock from suppliers and receive into warehouses.
        </p>
      </div>

      {canCreate && suppliers.length > 0 && items.length > 0 && warehouses.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New purchase order</h2>
          <PurchaseOrderForm
            suppliers={suppliers}
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              sku: i.sku,
              costPrice: Number(i.costPrice),
            }))}
            warehouses={warehouses}
          />
        </Card>
      ) : canCreate ? (
        <Card className="p-6 text-sm text-muted-foreground">
          You need at least one supplier, one item and one warehouse before creating a PO.
        </Card>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Supplier</th>
                <th className="px-4 py-2 text-left">Order date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No purchase orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.id} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link href={`/app/inventory/purchase-orders/${po.id}`} className="hover:underline">
                        {po.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{po.supplier.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {po.orderDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={"rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " + (statusColor[po.status] ?? "")}>
                        {po.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {po.currency} {Number(po.total).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/app/inventory/purchase-orders/${po.id}`} className="text-xs text-primary hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
