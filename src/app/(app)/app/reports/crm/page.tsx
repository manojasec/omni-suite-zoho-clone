import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STAGES = ["LEAD", "MQL", "SQL", "CUSTOMER", "CHURNED"] as const;

export default async function CrmAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStage, total, leadsRows, sourceGroups] = await Promise.all([
    prisma.contact.groupBy({
      by: ["lifecycleStage"],
      where: { workspaceId: wsId },
      _count: { _all: true },
    }),
    prisma.contact.count({ where: { workspaceId: wsId } }),
    prisma.contact.findMany({
      where: { workspaceId: wsId, lifecycleStage: "LEAD", createdAt: { gte: months[0].from } },
      select: { createdAt: true },
    }),
    prisma.contact.groupBy({
      by: ["source"],
      where: { workspaceId: wsId, source: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
      take: 8,
    }),
  ]);

  const stageMap = new Map(byStage.map((b) => [b.lifecycleStage, b._count._all]));
  const stageSeries = STAGES.map((s) => ({ label: s, value: stageMap.get(s) ?? 0 }));
  const sourceSeries = sourceGroups.map((s) => ({ label: s.source ?? "(none)", value: s._count._all }));
  const newLeads = bucketByMonth(leadsRows, months);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">CRM analytics</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="Total contacts" value={total.toLocaleString()} />
        <StatCard title="Leads" value={(stageMap.get("LEAD") ?? 0).toLocaleString()} />
        <StatCard title="Customers" value={(stageMap.get("CUSTOMER") ?? 0).toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Contacts by lifecycle stage" series={stageSeries} />
        <BarList title="Top sources" series={sourceSeries} />
      </div>

      <LineChart title="New leads per month" points={newLeads} />
    </div>
  );
}
