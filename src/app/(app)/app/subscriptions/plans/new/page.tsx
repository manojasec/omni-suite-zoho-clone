import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BILLING_INTERVALS } from "@/modules/subscriptions/schemas";
import { createPlanAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/subscriptions/plans" className="text-xs text-muted-foreground hover:underline">← Plans</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New plan</h1>
      <Card className="p-6">
        <form action={createPlanAction} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" required maxLength={60} placeholder="pro_monthly" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" required />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
            </div>
            <div>
              <Label htmlFor="interval">Interval</Label>
              <Select id="interval" name="interval" defaultValue="MONTH">
                {BILLING_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="intervalCount">Every</Label>
              <Input id="intervalCount" name="intervalCount" type="number" min={1} max={12} defaultValue={1} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="trialDays">Trial days</Label>
              <Input id="trialDays" name="trialDays" type="number" min={0} max={365} defaultValue={0} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input type="checkbox" id="active" name="active" defaultChecked />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={8000} />
          </div>
          <div className="flex justify-end"><Button type="submit">Create</Button></div>
        </form>
      </Card>
    </div>
  );
}
