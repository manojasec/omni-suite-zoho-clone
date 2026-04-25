import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteProductAction } from "./actions";
import { ProductCreateForm } from "./product-create-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const ctx = await requireSession();
  const products = await prisma.product.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ProductCreateForm />
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Tax %</th>
                <th className="px-4 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No products yet.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(p.price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{Number(p.taxPercent).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteProductAction.bind(null, p.id)}>
                        <Button type="submit" size="sm" variant="ghost">Delete</Button>
                      </form>
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
