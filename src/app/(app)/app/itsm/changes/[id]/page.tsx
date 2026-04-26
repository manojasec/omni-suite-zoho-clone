import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  CHANGE_RISKS,
  CHANGE_RISK_LABELS,
  CHANGE_STATUS_LABELS,
  CHANGE_TRANSITIONS,
} from "@/modules/itsm/schemas";
import {
  deleteChangeAction,
  transitionChangeAction,
  updateChangeAction,
} from "../../actions";

export const dynamic = "force-dynamic";

function fmtDateTimeLocal(d: Date | null): string {
  if (!d) return "";
  const z = new Date(d);
  if (Number.isNaN(z.getTime())) return "";
  // 'YYYY-MM-DDTHH:mm' local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}T${pad(
    z.getHours(),
  )}:${pad(z.getMinutes())}`;
}

export default async function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "view");

  const change = await prisma.change.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { asset: { select: { id: true, tag: true, name: true } } },
  });
  if (!change) notFound();

  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, name: true },
  });

  const canEdit = can(ctx.role, "change", "edit");
  const canManage = can(ctx.role, "change", "manage");
  const canDelete = can(ctx.role, "change", "delete");
  const editable =
    change.status !== "COMPLETED" &&
    change.status !== "REJECTED" &&
    change.status !== "CANCELED";

  const transitions = CHANGE_TRANSITIONS[change.status] ?? [];

  const updateBound = updateChangeAction.bind(null, change.id);
  const transitionBound = transitionChangeAction.bind(null, change.id);
  const deleteBound = deleteChangeAction.bind(null, change.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            CHG-{change.number}: {change.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {CHANGE_STATUS_LABELS[change.status]} · {CHANGE_RISK_LABELS[change.risk]} risk
          </p>
        </div>
        {canDelete && change.status !== "IN_PROGRESS" ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      {transitions.length > 0 ? (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm text-muted-foreground">Transition →</span>
          {transitions.map((t) => {
            const requiresManage = t === "APPROVED" || t === "REJECTED";
            const allowed = requiresManage ? canManage : canEdit;
            if (!allowed) return null;
            return (
              <form key={t} action={transitionBound}>
                <input type="hidden" name="to" value={t} />
                <Button type="submit" size="sm" variant="outline">
                  {CHANGE_STATUS_LABELS[t]}
                </Button>
              </form>
            );
          })}
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form action={updateBound} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={change.title}
              disabled={!canEdit || !editable}
            />
          </div>
          <div>
            <Label htmlFor="risk">Risk</Label>
            <Select
              id="risk"
              name="risk"
              defaultValue={change.risk}
              disabled={!canEdit || !editable}
            >
              {CHANGE_RISKS.map((r) => (
                <option key={r} value={r}>
                  {CHANGE_RISK_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="assetId">Asset</Label>
            <Select
              id="assetId"
              name="assetId"
              defaultValue={change.assetId ?? ""}
              disabled={!canEdit || !editable}
            >
              <option value="">— None —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.tag}] {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="scheduledAt">Scheduled at</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              defaultValue={fmtDateTimeLocal(change.scheduledAt)}
              disabled={!canEdit || !editable}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={change.description ?? ""}
              disabled={!canEdit || !editable}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rollbackPlan">Rollback plan</Label>
            <Textarea
              id="rollbackPlan"
              name="rollbackPlan"
              rows={3}
              defaultValue={change.rollbackPlan ?? ""}
              disabled={!canEdit || !editable}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={change.notes ?? ""}
              disabled={!canEdit || !editable}
            />
          </div>
          {canEdit && editable ? (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
