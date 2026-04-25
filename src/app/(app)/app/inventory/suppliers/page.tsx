import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { createSupplierAction, deleteSupplierAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const ctx = await requireSession();
  const suppliers = await prisma.supplier.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchaseOrders: true } } },
  });

  const canCreate = can(ctx.role, "supplier", "create");
  const canDelete = can(ctx.role, "supplier", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-sm text-muted-foreground">
          Vendors that fulfill your purchase orders.
        </p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New supplier</h2>
          <form action={createSupplierAction} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Acme Manufacturing" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" rows={2} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="sm">Create supplier</Button>
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
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Phone</th>
                <th className="px-4 py-2 text-right">POs</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No suppliers yet.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.phone ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s._count.purchaseOrders}</td>
                    <td className="px-4 py-2 text-right">
                      {canDelete ? (
                        <form action={deleteSupplierAction.bind(null, s.id)}>
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
