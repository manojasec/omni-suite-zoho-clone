import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  FLOW_TRIGGERS,
  FLOW_TRIGGER_LABELS,
} from "@/modules/flows/schemas";
import { createFlowAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewFlowPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "create");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New flow</h1>
        <p className="text-sm text-muted-foreground">
          Starts as a Draft with a Start → End graph. Add nodes and edges, then
          activate.
        </p>
      </div>

      <Card className="p-4">
        <form action={createFlowAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" maxLength={500} rows={3} />
          </div>
          <div>
            <Label htmlFor="trigger">Trigger</Label>
            <Select id="trigger" name="trigger" defaultValue="MANUAL">
              {FLOW_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {FLOW_TRIGGER_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create flow</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
