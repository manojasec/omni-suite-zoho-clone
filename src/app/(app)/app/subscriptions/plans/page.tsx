import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscriptionPlan", "view");
  const plans = await prisma.subscriptionPlan.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">{plans.length} plan{plans.length === 1 ? "" : "s"}</p>
        </div>
        {can(ctx.role, "subscriptionPlan", "create") ? (
          <Link href="/app/subscriptions/plans/new"><Button>+ New plan</Button></Link>
        ) : null}
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-left">Interval</th>
              <th className="px-3 py-2 text-right">Subs</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><Link href={`/app/subscriptions/plans/${p.id}`} className="hover:underline font-medium">{p.name}</Link></td>
                <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{p.code}</td>
                <td className="px-3 py-2 text-right">{p.currency} {Number(p.amount).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs">every {p.intervalCount} {p.interval.toLowerCase()}{p.intervalCount > 1 ? "s" : ""}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{p._count.subscriptions}</td>
                <td className="px-3 py-2 text-xs">{p.active ? <span className="text-green-700">active</span> : <span className="text-muted-foreground">archived</span>}</td>
              </tr>
            ))}
            {plans.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No plans yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
