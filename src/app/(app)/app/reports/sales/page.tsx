import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatCard, BarList } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

export default async function SalesAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const [byStage, openAgg, wonAgg, lostCount, openCount] = await Promise.all([
    prisma.deal.groupBy({
      by: ["stageId"],
      where: { workspaceId: wsId, status: "OPEN" },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.deal.aggregate({ where: { workspaceId: wsId, status: "OPEN" }, _sum: { value: true } }),
    prisma.deal.aggregate({ where: { workspaceId: wsId, status: "WON" }, _sum: { value: true }, _count: { _all: true } }),
    prisma.deal.count({ where: { workspaceId: wsId, status: "LOST" } }),
    prisma.deal.count({ where: { workspaceId: wsId, status: "OPEN" } }),
  ]);

  const stages = await prisma.stage.findMany({
    where: { id: { in: byStage.map((b) => b.stageId) } },
    include: { pipeline: { select: { name: true } } },
    orderBy: { order: "asc" },
  });
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  const stageValueSeries = byStage
    .map((b) => {
      const s = stageMap.get(b.stageId);
      return {
        label: s ? `${s.pipeline.name} · ${s.name}` : "(unknown)",
        value: Number(b._sum.value ?? 0),
        sub: `${b._count._all} deal${b._count._all === 1 ? "" : "s"}`,
      };
    })
    .sort((a, b) => b.value - a.value);

  const winRate =
    wonAgg._count._all + lostCount === 0
      ? 0
      : Math.round((wonAgg._count._all / (wonAgg._count._all + lostCount)) * 100);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Sales pipeline</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Open deals" value={openCount.toLocaleString()} />
        <StatCard title="Pipeline value" value={formatCurrency(Number(openAgg._sum.value ?? 0), currency)} />
        <StatCard title="Won (all-time)" value={formatCurrency(Number(wonAgg._sum.value ?? 0), currency)} hint={`${wonAgg._count._all} deals`} />
        <StatCard title="Win rate" value={`${winRate}%`} hint={`${wonAgg._count._all}W / ${lostCount}L`} />
      </div>

      <BarList
        title="Open pipeline by stage"
        series={stageValueSeries}
        formatValue={(v) => formatCurrency(v, currency)}
      />
    </div>
  );
}
