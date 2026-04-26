import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BILLING_INTERVALS } from "@/modules/subscriptions/schemas";
import { archivePlanAction, updatePlanAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "view");
  const { id } = await params;
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { subscriptions: { take: 20, orderBy: { createdAt: "desc" } } },
  });
  if (!plan) notFound();
  const canEdit = can(ctx.role, "subscriptionPlan", "edit");

  return (
    <div className="space-y-4">
      <Link href="/app/subscriptions/plans" className="text-xs text-muted-foreground hover:underline">← Plans</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">{plan.code} · {plan.currency} {Number(plan.amount).toFixed(2)} every {plan.intervalCount} {plan.interval.toLowerCase()}{plan.intervalCount > 1 ? "s" : ""} · {plan.active ? "Active" : "Archived"}</p>
        </div>
        {canEdit ? (
          <form action={archivePlanAction.bind(null, plan.id)}>
            <Button type="submit" variant="outline">{plan.active ? "Archive" : "Reactivate"}</Button>
          </form>
        ) : null}
      </div>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit plan</h2>
          <form action={updatePlanAction.bind(null, plan.id)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required defaultValue={plan.name} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" required defaultValue={plan.code} maxLength={60} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" min={0} step="0.01" required defaultValue={Number(plan.amount).toFixed(2)} />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue={plan.currency} maxLength={3} />
              </div>
              <div>
                <Label htmlFor="interval">Interval</Label>
                <Select id="interval" name="interval" defaultValue={plan.interval}>
                  {BILLING_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="intervalCount">Every</Label>
                <Input id="intervalCount" name="intervalCount" type="number" min={1} max={12} defaultValue={plan.intervalCount} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="trialDays">Trial days</Label>
                <Input id="trialDays" name="trialDays" type="number" min={0} max={365} defaultValue={plan.trialDays} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input type="checkbox" id="active" name="active" defaultChecked={plan.active} />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={8000} defaultValue={plan.description ?? ""} />
            </div>
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">Recent subscriptions ({plan.subscriptions.length})</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1 text-left">Customer</th>
              <th className="px-3 py-1 text-left">Status</th>
              <th className="px-3 py-1 text-right">Qty</th>
              <th className="px-3 py-1 text-left">Period ends</th>
            </tr>
          </thead>
          <tbody>
            {plan.subscriptions.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><Link href={`/app/subscriptions/${s.id}`} className="hover:underline">{s.customerName}</Link><div className="text-xs text-muted-foreground">{s.customerEmail}</div></td>
                <td className="px-3 py-2 text-xs">{s.status}</td>
                <td className="px-3 py-2 text-right">{s.quantity}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.currentPeriodEnd.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {plan.subscriptions.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No subscriptions on this plan.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
