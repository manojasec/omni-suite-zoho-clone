import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { createItemAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireSession();
  const { q } = await searchParams;
  const items = await prisma.inventoryItem.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: { stock: { select: { quantity: true } } },
    take: 200,
  });

  const canCreate = can(ctx.role, "inventoryItem", "create");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory items</h1>
          <p className="text-sm text-muted-foreground">
            Stockable products tracked across warehouses.
          </p>
        </div>
        <form className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Search name / SKU…" className="w-64" />
          <Button type="submit" variant="outline" size="sm">Search</Button>
        </form>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New item</h2>
          <form action={createItemAction} className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Pro Hoodie – Black / L" />
            </div>
            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" name="sku" required placeholder="HD-BLK-L" />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" defaultValue="each" />
            </div>
            <div>
              <Label htmlFor="costPrice">Cost price</Label>
              <Input id="costPrice" name="costPrice" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
            <div>
              <Label htmlFor="salePrice">Sale price</Label>
              <Input id="salePrice" name="salePrice" type="number" step="0.01" min="0" defaultValue="0" />
            </div>
            <div>
              <Label htmlFor="reorderPoint">Reorder point</Label>
              <Input id="reorderPoint" name="reorderPoint" type="number" min="0" defaultValue="0" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="trackStock" name="trackStock" defaultChecked />
              <Label htmlFor="trackStock" className="text-sm">Track stock</Label>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">Create item</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Sale</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Reorder at</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No items yet.
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const onHand = it.stock.reduce((acc, s) => acc + s.quantity, 0);
                  const low = it.trackStock && onHand <= it.reorderPoint;
                  return (
                    <tr key={it.id} className="border-b">
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/app/inventory/items/${it.id}`} className="hover:underline">
                          {it.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{it.sku}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(it.costPrice).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{Number(it.salePrice).toFixed(2)}</td>
                      <td className={"px-4 py-2 text-right tabular-nums " + (low ? "text-destructive font-semibold" : "")}>
                        {it.trackStock ? onHand : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{it.reorderPoint}</td>
                      <td className="px-4 py-2 text-right">
                        <Link href={`/app/inventory/items/${it.id}`} className="text-xs text-primary hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
