import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import {
  cancelPurchaseOrderAction,
  deletePurchaseOrderAction,
  receivePurchaseOrderAction,
  sendPurchaseOrderAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  PARTIAL: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export default async function PODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      supplier: true,
      lines: {
        include: {
          item: { select: { name: true, sku: true } },
          warehouse: { select: { name: true } },
        },
      },
    },
  });
  if (!po) return notFound();

  const canSend = can(ctx.role, "purchaseOrder", "send");
  const canEdit = can(ctx.role, "purchaseOrder", "edit");
  const canDelete = can(ctx.role, "purchaseOrder", "delete");

  const isReceivable = po.status === "SENT" || po.status === "PARTIAL";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/app/inventory/purchase-orders" className="text-xs text-muted-foreground hover:underline">
            ← Purchase orders
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight font-mono">{po.number}</h1>
          <p className="text-sm text-muted-foreground">
            {po.supplier.name} · {po.orderDate.toISOString().slice(0, 10)}
            {po.expectedDate ? ` · expected ${po.expectedDate.toISOString().slice(0, 10)}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={"rounded px-2 py-0.5 text-xs font-medium uppercase " + (statusColor[po.status] ?? "")}>
            {po.status}
          </span>
          <div className="flex gap-2">
            {po.status === "DRAFT" && canSend ? (
              <form action={sendPurchaseOrderAction.bind(null, po.id)}>
                <Button type="submit" size="sm">Send to supplier</Button>
              </form>
            ) : null}
            {po.status !== "RECEIVED" && po.status !== "CANCELLED" && canEdit ? (
              <form action={cancelPurchaseOrderAction.bind(null, po.id)}>
                <Button type="submit" size="sm" variant="outline">Cancel PO</Button>
              </form>
            ) : null}
            {(po.status === "DRAFT" || po.status === "CANCELLED") && canDelete ? (
              <form action={deletePurchaseOrderAction.bind(null, po.id)}>
                <Button type="submit" size="sm" variant="destructive">Delete</Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Line items</h2>
        </div>
        <form action={receivePurchaseOrderAction.bind(null, po.id)}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-left">Warehouse</th>
                  <th className="px-4 py-2 text-right">Ordered</th>
                  <th className="px-4 py-2 text-right">Received</th>
                  <th className="px-4 py-2 text-right">Unit cost</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  {isReceivable && canEdit ? <th className="px-4 py-2 text-right w-32">Receive now</th> : null}
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => {
                  const remaining = l.qtyOrdered - l.qtyReceived;
                  return (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-2">
                        <div className="font-medium">{l.item.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{l.item.sku}</div>
                        {l.description && l.description !== l.item.name ? (
                          <div className="text-xs text-muted-foreground">{l.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">{l.warehouse.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{l.qtyOrdered}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {l.qtyReceived}
                        {remaining > 0 ? <span className="ml-1 text-xs text-muted-foreground">(− {remaining})</span> : null}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(l.unitCost).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(l.amount).toFixed(2)}</td>
                      {isReceivable && canEdit ? (
                        <td className="px-4 py-2 text-right">
                          {remaining > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              name={`receive[${l.id}]`}
                              placeholder={`up to ${remaining}`}
                              className="w-24 text-right"
                            />
                          ) : (
                            <span className="text-xs text-emerald-600">✓</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="space-y-0.5 text-sm">
              <div className="flex gap-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{po.currency} {Number(po.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">{po.currency} {Number(po.tax).toFixed(2)}</span>
              </div>
              <div className="flex gap-3 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{po.currency} {Number(po.total).toFixed(2)}</span>
              </div>
            </div>
            {isReceivable && canEdit ? (
              <Button type="submit" size="sm">Receive stock</Button>
            ) : null}
          </div>
        </form>
      </Card>

      {po.notes ? (
        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{po.notes}</p>
        </Card>
      ) : null}
    </div>
  );
}
