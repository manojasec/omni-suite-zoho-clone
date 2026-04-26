import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Repeat, Package, Receipt, TrendingUp } from "lucide-react";
import { isLiveSubscriptionStatus, mrrFor } from "@/modules/subscriptions/schemas";

export const dynamic = "force-dynamic";

export default async function SubscriptionsHubPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "view");

  const [plans, subs, openInvoices] = await Promise.all([
    prisma.subscriptionPlan.count({ where: { workspaceId: ctx.workspaceId, active: true } }),
    prisma.subscription.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { plan: { select: { amount: true, interval: true, intervalCount: true, currency: true } } },
    }),
    prisma.subscriptionInvoice.count({ where: { workspaceId: ctx.workspaceId, status: "OPEN" } }),
  ]);

  const live = subs.filter((s) => isLiveSubscriptionStatus(s.status));
  const mrr = live.reduce(
    (sum, s) =>
      sum +
      mrrFor({
        amount: Number(s.plan.amount),
        interval: s.plan.interval,
        intervalCount: s.plan.intervalCount,
        quantity: s.quantity,
      }),
    0,
  );

  const stats = [
    { label: "Active plans", value: plans, icon: Package, href: "/app/subscriptions/plans" },
    { label: "Live subscriptions", value: live.length, icon: Repeat, href: "/app/subscriptions" },
    { label: "MRR", value: `$${mrr.toFixed(2)}`, icon: TrendingUp, href: "/app/subscriptions" },
    { label: "Open invoices", value: openInvoices, icon: Receipt, href: "/app/subscriptions/invoices" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">Recurring billing — plans, subscriptions, and invoices.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} href={s.href}>
              <Card className="p-4 hover:bg-muted/40">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{s.label}</div>
                <div className="mt-1 text-2xl font-semibold">{s.value}</div>
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/app/subscriptions/plans/new"><Card className="p-4 hover:bg-muted/40"><div className="text-sm font-semibold">+ New plan</div><p className="text-xs text-muted-foreground">Define recurring pricing.</p></Card></Link>
        <Link href="/app/subscriptions/new"><Card className="p-4 hover:bg-muted/40"><div className="text-sm font-semibold">+ New subscription</div><p className="text-xs text-muted-foreground">Subscribe a customer.</p></Card></Link>
        <Link href="/app/subscriptions/invoices"><Card className="p-4 hover:bg-muted/40"><div className="text-sm font-semibold">All invoices</div><p className="text-xs text-muted-foreground">Track recurring billings.</p></Card></Link>
      </div>
    </div>
  );
}
