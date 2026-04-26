import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createPayRunAction } from "../actions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function lastOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default async function NewPayRunPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "payRun", "create");

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New pay run</h1>
        <p className="text-sm text-muted-foreground">
          Define the period, then add employees and adjust line items in the next step.
        </p>
      </div>

      <Card className="p-4">
        <form action={createPayRunAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={160}
              placeholder="April 2026 monthly run"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="periodStart">Period start</Label>
              <Input
                id="periodStart"
                name="periodStart"
                type="date"
                required
                defaultValue={firstOfMonthISO()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="periodEnd">Period end</Label>
              <Input
                id="periodEnd"
                name="periodEnd"
                type="date"
                required
                defaultValue={lastOfMonthISO()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payDate">Pay date</Label>
              <Input
                id="payDate"
                name="payDate"
                type="date"
                required
                defaultValue={todayISO()}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue="USD"
              className="uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Optional notes…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit">Create pay run</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
