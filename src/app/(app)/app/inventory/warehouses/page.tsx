import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { createWarehouseAction, deleteWarehouseAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const ctx = await requireSession();
  const warehouses = await prisma.warehouse.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { stock: true } } },
  });

  const canCreate = can(ctx.role, "warehouse", "create");
  const canDelete = can(ctx.role, "warehouse", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
        <p className="text-sm text-muted-foreground">
          Physical or virtual locations where inventory is stored.
        </p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New warehouse</h2>
          <form action={createWarehouseAction} className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Main warehouse" />
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="WH-01" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" name="isDefault" />
              <Label htmlFor="isDefault" className="text-sm">Make default</Label>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="sm">Create warehouse</Button>
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
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-right">Items stocked</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No warehouses yet.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id} className="border-b">
                    <td className="px-4 py-2 font-medium">
                      {w.name}
                      {w.isDefault ? (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-primary">
                          Default
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{w.code ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{w.address ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{w._count.stock}</td>
                    <td className="px-4 py-2 text-right">
                      {canDelete ? (
                        <form action={deleteWarehouseAction.bind(null, w.id)}>
                          <Button type="submit" size="sm" variant="ghost">Delete</Button>
                        </form>
                      ) : null}
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
