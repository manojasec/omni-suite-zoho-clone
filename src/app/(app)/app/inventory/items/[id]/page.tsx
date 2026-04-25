import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { adjustStockAction, deleteItemAction, updateItemAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const item = await prisma.inventoryItem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      stock: { include: { warehouse: { select: { id: true, name: true } } } },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { warehouse: { select: { name: true } } },
      },
    },
  });
  if (!item) return notFound();

  const warehouses = await prisma.warehouse.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const canEdit = can(ctx.role, "inventoryItem", "edit");
  const canDelete = can(ctx.role, "inventoryItem", "delete");

  const onHand = item.stock.reduce((a, s) => a + s.quantity, 0);
  const update = updateItemAction.bind(null, item.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/app/inventory/items" className="text-xs text-muted-foreground hover:underline">
            ← Items
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            SKU <span className="font-mono">{item.sku}</span> · {item.unit} · On hand <strong>{onHand}</strong>
          </p>
        </div>
        {canDelete ? (
          <form action={deleteItemAction.bind(null, item.id)}>
            <Button type="submit" variant="destructive" size="sm">Delete item</Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit details</h2>
          <form action={update} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={item.name} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" required defaultValue={item.sku} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" defaultValue={item.unit} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="costPrice">Cost price</Label>
              <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0"
                defaultValue={Number(item.costPrice).toFixed(2)} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="salePrice">Sale price</Label>
              <Input id="salePrice" name="salePrice" type="number" step="0.01" min="0"
                defaultValue={Number(item.salePrice).toFixed(2)} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="reorderPoint">Reorder point</Label>
              <Input id="reorderPoint" name="reorderPoint" type="number" min="0"
                defaultValue={item.reorderPoint} disabled={!canEdit} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="trackStock" name="trackStock"
                defaultChecked={item.trackStock} disabled={!canEdit} />
              <Label htmlFor="trackStock" className="text-sm">Track stock</Label>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2}
                defaultValue={item.description ?? ""} disabled={!canEdit} />
            </div>
            {canEdit ? (
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" size="sm">Save</Button>
              </div>
            ) : null}
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Stock by warehouse</h2>
          {item.stock.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 text-left">Warehouse</th>
                  <th className="py-1 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {item.stock.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    <td className="py-1.5">{s.warehouse.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canEdit && warehouses.length > 0 ? (
            <form action={adjustStockAction} className="mt-6 grid gap-2 md:grid-cols-4">
              <input type="hidden" name="itemId" value={item.id} />
              <div className="md:col-span-2">
                <Label htmlFor="warehouseId">Warehouse</Label>
                <Select id="warehouseId" name="warehouseId" required>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="delta">Δ qty (+/-)</Label>
                <Input id="delta" name="delta" type="number" required placeholder="+10 or -5" />
              </div>
              <div className="md:col-span-4">
                <Label htmlFor="note">Note</Label>
                <Input id="note" name="note" placeholder="Reason for adjustment" />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button type="submit" size="sm" variant="outline">Adjust stock</Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>

      <Card>
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Movement history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Warehouse</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-left">Reference</th>
                <th className="px-4 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {item.movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No movements yet.
                  </td>
                </tr>
              ) : (
                item.movements.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs">{m.type}</td>
                    <td className="px-4 py-2">{m.warehouse.name}</td>
                    <td className={"px-4 py-2 text-right tabular-nums " + (m.quantity < 0 ? "text-destructive" : "text-emerald-600")}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{m.reference ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.note ?? ""}</td>
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
