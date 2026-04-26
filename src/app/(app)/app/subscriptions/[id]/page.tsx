import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SUBSCRIPTION_INVOICE_STATUSES,
  SUBSCRIPTION_STATUSES,
  isValidSubscriptionTransition,
} from "@/modules/subscriptions/schemas";
import {
  changeInvoiceStatusAction,
  changeSubscriptionStatusAction,
  generateInvoiceAction,
  toggleCancelAtPeriodEndAction,
  updateSubscriptionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "view");
  const { id } = await params;
  const sub = await prisma.subscription.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      plan: true,
      invoices: { orderBy: { issuedAt: "desc" } },
    },
  });
  if (!sub) notFound();
  const canEdit = can(ctx.role, "subscription", "edit");
  const canInvoice = can(ctx.role, "subscriptionInvoice", "create");
  const canEditInvoice = can(ctx.role, "subscriptionInvoice", "edit");

  const allowedNext = SUBSCRIPTION_STATUSES.filter((s) => isValidSubscriptionTransition(sub.status, s));

  return (
    <div className="space-y-4">
      <Link href="/app/subscriptions/list" className="text-xs text-muted-foreground hover:underline">← Subscriptions</Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sub.customerName}</h1>
          <p className="text-sm text-muted-foreground">{sub.customerEmail} · <Link href={`/app/subscriptions/plans/${sub.planId}`} className="hover:underline">{sub.plan.name}</Link> · {sub.plan.currency} {Number(sub.plan.amount).toFixed(2)} × {sub.quantity}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Status: <span className="font-medium text-foreground">{sub.status}</span></div>
          <div>Period: {sub.currentPeriodStart.toISOString().slice(0, 10)} → {sub.currentPeriodEnd.toISOString().slice(0, 10)}</div>
          {sub.trialEndsAt ? <div>Trial ends: {sub.trialEndsAt.toISOString().slice(0, 10)}</div> : null}
          {sub.cancelAtPeriodEnd ? <div className="text-amber-600">Cancels at period end</div> : null}
        </div>
      </div>

      {canEdit ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Change status</h2>
            <form action={changeSubscriptionStatusAction.bind(null, sub.id)} className="flex gap-2">
              <Select name="status" defaultValue={sub.status} className="flex-1">
                {allowedNext.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Button type="submit" size="sm">Apply</Button>
            </form>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Auto-cancel</h2>
            <form action={toggleCancelAtPeriodEndAction.bind(null, sub.id)}>
              <Button type="submit" variant="outline" size="sm">
                {sub.cancelAtPeriodEnd ? "Resume after period" : "Cancel at period end"}
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit subscription</h2>
          <form action={updateSubscriptionAction.bind(null, sub.id)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="customerName">Customer name</Label>
                <Input id="customerName" name="customerName" required defaultValue={sub.customerName} maxLength={160} />
              </div>
              <div>
                <Label htmlFor="customerEmail">Customer email</Label>
                <Input id="customerEmail" name="customerEmail" type="email" required defaultValue={sub.customerEmail} maxLength={160} />
              </div>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" min={1} max={9999} required defaultValue={sub.quantity} />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={sub.notes ?? ""} />
            </div>
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between bg-muted px-3 py-2">
          <span className="text-sm font-semibold">Invoices ({sub.invoices.length})</span>
          {canInvoice ? (
            <form action={generateInvoiceAction.bind(null, sub.id)}>
              <Button type="submit" size="sm" variant="outline">Generate invoice & advance period</Button>
            </form>
          ) : null}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1 text-left">Number</th>
              <th className="px-3 py-1 text-left">Period</th>
              <th className="px-3 py-1 text-right">Amount</th>
              <th className="px-3 py-1 text-left">Status</th>
              <th className="px-3 py-1 text-left">Issued</th>
            </tr>
          </thead>
          <tbody>
            {sub.invoices.map((iv) => (
              <tr key={iv.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{iv.number}</td>
                <td className="px-3 py-2 text-xs">{iv.periodStart.toISOString().slice(0, 10)} → {iv.periodEnd.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">{iv.currency} {Number(iv.amount).toFixed(2)}</td>
                <td className="px-3 py-2">
                  {canEditInvoice ? (
                    <form action={changeInvoiceStatusAction.bind(null, iv.id)} className="flex gap-1">
                      <Select name="status" defaultValue={iv.status} className="h-8 text-xs">
                        {SUBSCRIPTION_INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
                  ) : <span className="text-xs">{iv.status}</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{iv.issuedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {sub.invoices.length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No invoices yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
