import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function StoreCustomersPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "storeCustomer", "view");

  const customers = await prisma.storeCustomer.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });

  const canCreate = can(ctx.role, "storeCustomer", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store customers</h1>
          <p className="text-sm text-muted-foreground">
            Buyers from your storefront with order history.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/store/customers/new">
            <Button>New customer</Button>
          </Link>
        ) : null}
      </div>

      {customers.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No store customers yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {customers.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/store/customers/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {c.email}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {c._count.orders} order{c._count.orders === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
