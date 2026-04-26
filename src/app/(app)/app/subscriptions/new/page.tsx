import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSubscriptionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "create");
  const plans = await prisma.subscriptionPlan.findMany({
    where: { workspaceId: ctx.workspaceId, active: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <Link href="/app/subscriptions" className="text-xs text-muted-foreground hover:underline">← Subscriptions</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New subscription</h1>
      {plans.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No active plans yet. <Link href="/app/subscriptions/plans/new" className="underline">Create a plan</Link> first.
        </Card>
      ) : (
        <Card className="p-6">
          <form action={createSubscriptionAction} className="space-y-4">
            <div>
              <Label htmlFor="planId">Plan</Label>
              <Select id="planId" name="planId" required>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.currency} {Number(p.amount).toFixed(2)} / {p.intervalCount} {p.interval.toLowerCase()}{p.intervalCount > 1 ? "s" : ""}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="customerName">Customer name</Label>
                <Input id="customerName" name="customerName" required maxLength={160} />
              </div>
              <div>
                <Label htmlFor="customerEmail">Customer email</Label>
                <Input id="customerEmail" name="customerEmail" type="email" required maxLength={160} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" min={1} max={9999} defaultValue={1} />
              </div>
              <div>
                <Label htmlFor="startedAt">Start date</Label>
                <Input id="startedAt" name="startedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
            </div>
            <div className="flex justify-end"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
    </div>
  );
}
