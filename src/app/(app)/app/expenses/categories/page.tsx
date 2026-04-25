import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import { createExpenseCategoryAction, deleteExpenseCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExpenseCategoriesPage() {
  const ctx = await requireSession();
  const categories = await prisma.expenseCategory.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { expenses: true } } },
  });

  const canCreate = can(ctx.role, "expenseCategory", "create");
  const canDelete = can(ctx.role, "expenseCategory", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expense categories</h1>
        <p className="text-sm text-muted-foreground">
          Group expenses for reporting (e.g. Travel, Meals, Software).
        </p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New category</h2>
          <form action={createExpenseCategoryAction} className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Travel" />
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="TRV" />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">Create category</Button>
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
                <th className="px-4 py-2 text-right">Expenses</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    No categories yet.
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.code ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c._count.expenses}</td>
                    <td className="px-4 py-2 text-right">
                      {canDelete ? (
                        <form action={deleteExpenseCategoryAction.bind(null, c.id)}>
                          <Button type="submit" size="sm" variant="ghost">Archive</Button>
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
