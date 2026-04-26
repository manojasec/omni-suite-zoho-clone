import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  formatDate,
} from "@/modules/itsm/schemas";
import {
  assignAssetAction,
  deleteAssetAction,
  updateAssetAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "view");

  const asset = await prisma.asset.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      assignedTo: { select: { firstName: true, lastName: true, email: true } },
      changes: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, number: true, title: true, status: true },
      },
      problems: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, number: true, title: true, status: true },
      },
    },
  });
  if (!asset) notFound();

  const employees = await prisma.employee.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  const canEdit = can(ctx.role, "asset", "edit");
  const canAssign = can(ctx.role, "asset", "assign");
  const canDelete = can(ctx.role, "asset", "delete");

  const updateBound = updateAssetAction.bind(null, asset.id);
  const assignBound = assignAssetAction.bind(null, asset.id);
  const deleteBound = deleteAssetAction.bind(null, asset.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            [{asset.tag}] {asset.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {asset.category} · {ASSET_STATUS_LABELS[asset.status]}
          </p>
        </div>
        {canDelete ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <form action={updateBound} className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="tag">Tag</Label>
              <Input id="tag" name="tag" defaultValue={asset.tag} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={asset.name} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                defaultValue={asset.category}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                defaultValue={asset.status}
                disabled={!canEdit}
              >
                {ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ASSET_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="serial">Serial</Label>
              <Input
                id="serial"
                name="serial"
                defaultValue={asset.serial ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                name="vendor"
                defaultValue={asset.vendor ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                defaultValue={asset.location ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="assignedToEmployeeId">Assigned to</Label>
              <Select
                id="assignedToEmployeeId"
                name="assignedToEmployeeId"
                defaultValue={asset.assignedToEmployeeId ?? ""}
                disabled={!canEdit}
              >
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
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={formatDate(asset.purchaseDate)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={asset.cost != null ? Number(asset.cost) : ""}
                disabled={!canEdit}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={asset.notes ?? ""}
                disabled={!canEdit}
              />
            </div>
            {canEdit ? (
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Save</Button>
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-3">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Assignment</h2>
            {asset.assignedTo ? (
              <p className="text-sm">
                {asset.assignedTo.firstName} {asset.assignedTo.lastName}{" "}
                <span className="text-muted-foreground">
                  ({asset.assignedTo.email})
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Unassigned</p>
            )}
            {canAssign ? (
              <form action={assignBound} className="mt-3 flex gap-2">
                <Select
                  name="assignedToEmployeeId"
                  defaultValue={asset.assignedToEmployeeId ?? ""}
                  className="flex-1"
                >
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline">
                  Assign
                </Button>
              </form>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Recent changes</h2>
            {asset.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes raised.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {asset.changes.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/app/itsm/changes/${c.id}`}
                      className="hover:underline"
                    >
                      CHG-{c.number}: {c.title}
                    </a>{" "}
                    <span className="text-xs text-muted-foreground">{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Recent problems</h2>
            {asset.problems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No problems raised.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {asset.problems.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/app/itsm/problems/${p.id}`}
                      className="hover:underline"
                    >
                      PRB-{p.number}: {p.title}
                    </a>{" "}
                    <span className="text-xs text-muted-foreground">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
