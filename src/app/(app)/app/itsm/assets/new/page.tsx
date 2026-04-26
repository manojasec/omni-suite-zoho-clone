import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/modules/itsm/schemas";
import { createAssetAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "create");

  const employees = await prisma.employee.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New asset</h1>
        <p className="text-sm text-muted-foreground">
          Add a piece of hardware or software to the inventory.
        </p>
      </div>

      <Card className="p-4">
        <form action={createAssetAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="tag">Asset tag</Label>
            <Input id="tag" name="tag" placeholder="auto" />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank to auto-generate (AST-NNNN).
            </p>
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" defaultValue="laptop" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="IN_USE">
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ASSET_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="serial">Serial</Label>
            <Input id="serial" name="serial" />
          </div>
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Input id="vendor" name="vendor" />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" />
          </div>
          <div>
            <Label htmlFor="assignedToEmployeeId">Assigned to</Label>
            <Select id="assignedToEmployeeId" name="assignedToEmployeeId" defaultValue="">
              <option value="">— Unassigned —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input id="purchaseDate" name="purchaseDate" type="date" />
          </div>
          <div>
            <Label htmlFor="cost">Cost</Label>
            <Input id="cost" name="cost" type="number" step="0.01" min="0" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create asset</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
