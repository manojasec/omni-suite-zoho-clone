import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  STOREFRONT_STATUSES,
  STOREFRONT_STATUS_LABELS,
} from "@/modules/commerce/schemas";
import { upsertStorefrontAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StorefrontPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "storefront", "view");

  const storefront = await prisma.storefront.findFirst({
    where: { workspaceId: ctx.workspaceId },
  });

  const [customerCount, orderCount, openOrderCount] = await Promise.all([
    prisma.storeCustomer.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.storeOrder.count({ where: { workspaceId: ctx.workspaceId } }),
    prisma.storeOrder.count({
      where: { workspaceId: ctx.workspaceId, status: "PENDING" },
    }),
  ]);

  const canEdit = can(ctx.role, "storefront", "edit");
  const slugDefault = storefront?.slug ?? `${ctx.workspaceSlug}-store`;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storefront</h1>
        <p className="text-sm text-muted-foreground">
          Public-facing store settings, customers, and orders.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Customers</div>
          <div className="mt-1 text-2xl font-semibold">{customerCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total orders</div>
          <div className="mt-1 text-2xl font-semibold">{orderCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pending orders</div>
          <div className="mt-1 text-2xl font-semibold">{openOrderCount}</div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {storefront ? "Storefront settings" : "Configure storefront"}
        </h2>
        <form action={upsertStorefrontAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              name="slug"
              required
              defaultValue={storefront?.slug ?? slugDefault}
              disabled={!canEdit}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens.
            </p>
          </div>
          <div>
            <Label htmlFor="name">Store name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={storefront?.name ?? ctx.workspaceName}
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              name="headline"
              defaultValue={storefront?.headline ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue={storefront?.currency ?? "USD"}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="supportEmail">Support email</Label>
            <Input
              id="supportEmail"
              name="supportEmail"
              type="email"
              defaultValue={storefront?.supportEmail ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={storefront?.status ?? "DRAFT"}
              disabled={!canEdit}
            >
              {STOREFRONT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STOREFRONT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          {canEdit ? (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">
                {storefront ? "Save" : "Create storefront"}
              </Button>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
