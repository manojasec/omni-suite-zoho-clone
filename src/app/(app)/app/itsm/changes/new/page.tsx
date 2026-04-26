import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { CHANGE_RISKS, CHANGE_RISK_LABELS } from "@/modules/itsm/schemas";
import { createChangeAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewChangePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "change", "create");

  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, name: true },
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New change</h1>
        <p className="text-sm text-muted-foreground">
          Raise a change request. It will start in DRAFT and follow the approval workflow.
        </p>
      </div>

      <Card className="p-4">
        <form action={createChangeAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="risk">Risk</Label>
            <Select id="risk" name="risk" defaultValue="MEDIUM">
              {CHANGE_RISKS.map((r) => (
                <option key={r} value={r}>
                  {CHANGE_RISK_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="assetId">Asset (optional)</Label>
            <Select id="assetId" name="assetId" defaultValue="">
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
            <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rollbackPlan">Rollback plan</Label>
            <Textarea id="rollbackPlan" name="rollbackPlan" rows={3} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create change</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
