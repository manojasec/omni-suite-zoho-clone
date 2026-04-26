import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SUBSCRIPTION_STATUSES } from "@/modules/subscriptions/schemas";

export const dynamic = "force-dynamic";

export default async function SubscriptionsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "subscription", "view");
  const sp = await searchParams;
  const status = SUBSCRIPTION_STATUSES.includes(sp.status as never) ? (sp.status as (typeof SUBSCRIPTION_STATUSES)[number]) : undefined;
  const q = (sp.q ?? "").trim();
  const subs = await prisma.subscription.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ customerName: { contains: q } }, { customerEmail: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true, currency: true, amount: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">{subs.length} subscription{subs.length === 1 ? "" : "s"}</p>
        </div>
        {can(ctx.role, "subscription", "create") ? (
          <Link href="/app/subscriptions/new"><Button>+ New subscription</Button></Link>
        ) : null}
      </div>

      <Card className="p-3">
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Search customer..." className="flex-1" />
          <Select name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Button type="submit" variant="outline">Filter</Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-left">Period ends</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><Link href={`/app/subscriptions/${s.id}`} className="hover:underline font-medium">{s.customerName}</Link><div className="text-xs text-muted-foreground">{s.customerEmail}</div></td>
                <td className="px-3 py-2">{s.plan.name}<div className="text-xs text-muted-foreground">{s.plan.currency} {Number(s.plan.amount).toFixed(2)}</div></td>
                <td className="px-3 py-2 text-xs">{s.status}{s.cancelAtPeriodEnd ? " (cancel)" : ""}</td>
                <td className="px-3 py-2 text-right">{s.quantity}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.currentPeriodEnd.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {subs.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No subscriptions match.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
