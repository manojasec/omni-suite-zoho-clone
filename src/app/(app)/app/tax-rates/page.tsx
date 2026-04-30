import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatRate } from "@/modules/tax-rates/schemas";
import {
  archiveTaxRateAction,
  createTaxRateAction,
  updateTaxRateAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TaxRatesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "taxRate", "view");
  const canCreate = can(ctx.role, "taxRate", "create");
  const canEdit = can(ctx.role, "taxRate", "edit");
  const canArchive = can(ctx.role, "taxRate", "delete");

  const rates = await prisma.taxRate.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isArchived: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tax rates</h1>
        <p className="text-sm text-muted-foreground">
          Define VAT, GST, sales tax and other rates used on invoices and quotes.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Add a tax rate</h2>
          <form
            action={createTaxRateAction}
            className="grid gap-3 sm:grid-cols-5"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="rate">Rate %</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.001"
                min="0"
                max="100"
                required
              />
            </div>
            <div>
              <Label htmlFor="region">Region</Label>
              <Input id="region" name="region" maxLength={80} />
            </div>
            <div className="space-y-1 self-end text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isInclusive" />
                Inclusive
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isDefault" />
                Default
              </label>
            </div>
            <div className="sm:col-span-5 flex justify-end">
              <Button type="submit">Add tax rate</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {rates.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No tax rates defined yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {rates.map((r) => (
            <div key={r.id} className="space-y-2 p-3">
              <form
                action={updateTaxRateAction.bind(null, r.id)}
                className="grid items-end gap-3 sm:grid-cols-5"
              >
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input
                    name="name"
                    defaultValue={r.name}
                    required
                    maxLength={120}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Rate %</Label>
                  <Input
                    name="rate"
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    defaultValue={Number(r.rate).toString()}
                    required
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label>Region</Label>
                  <Input
                    name="region"
                    defaultValue={r.region ?? ""}
                    maxLength={80}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isInclusive"
                      defaultChecked={r.isInclusive}
                      disabled={!canEdit}
                    />
                    Inclusive
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={r.isDefault}
                      disabled={!canEdit}
                    />
                    Default
                  </label>
                </div>
                <div className="sm:col-span-5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatRate(Number(r.rate))}
                    {r.isDefault ? " · default" : ""}
                    {r.isArchived ? " · archived" : ""}
                  </span>
                  <span className="ml-auto" />
                  {canEdit && !r.isArchived ? (
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  ) : null}
                </div>
              </form>
              {canArchive ? (
                <form action={archiveTaxRateAction.bind(null, r.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    {r.isArchived ? "Unarchive" : "Archive"}
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
