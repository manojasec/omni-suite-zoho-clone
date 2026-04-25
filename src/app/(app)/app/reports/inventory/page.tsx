import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const TYPES = ["RECEIVE", "SHIP", "ADJUST", "TRANSFER"] as const;

export default async function InventoryAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [items, stockLevels, byType, recentMovements, totalMovements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { workspaceId: wsId },
      select: { id: true, name: true, sku: true, costPrice: true, reorderPoint: true },
    }),
    prisma.stockLevel.findMany({
      where: { item: { workspaceId: wsId } },
      select: { itemId: true, quantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["type"],
      where: { workspaceId: wsId },
      _count: { _all: true },
    }),
    prisma.stockMovement.findMany({
      where: { workspaceId: wsId, createdAt: { gte: months[0].from } },
      select: { createdAt: true, type: true, quantity: true },
    }),
    prisma.stockMovement.count({ where: { workspaceId: wsId } }),
  ]);

  const ws = await prisma.workspace.findUnique({ where: { id: wsId }, select: { currency: true } });
  const currency = ws?.currency ?? "USD";

  // On-hand totals per item
  const onHand = new Map<string, number>();
  for (const lvl of stockLevels) {
    onHand.set(lvl.itemId, (onHand.get(lvl.itemId) ?? 0) + lvl.quantity);
  }

  let stockValue = 0;
  const lowStock: { label: string; value: number; sub?: string }[] = [];
  const topByValue: { label: string; value: number; sub?: string }[] = [];
  for (const item of items) {
    const qty = onHand.get(item.id) ?? 0;
    const value = qty * Number(item.costPrice);
    stockValue += value;
    if (item.reorderPoint > 0 && qty <= item.reorderPoint) {
      lowStock.push({ label: item.name, value: qty, sub: `${item.sku} · reorder @${item.reorderPoint}` });
    }
    if (value > 0) {
      topByValue.push({ label: item.name, value: Math.round(value), sub: `${qty} on hand` });
    }
  }
  topByValue.sort((a, b) => b.value - a.value);

  const inboundSeries = bucketByMonth(
    recentMovements.filter((m) => m.type === "RECEIVE").map((m) => ({ createdAt: m.createdAt, q: m.quantity })),
    months,
    (r) => r.q,
  );

  const typeCounts = new Map(byType.map((b) => [b.type, b._count._all]));

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Inventory analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Items" value={items.length.toLocaleString()} />
        <StatCard title="Stock value" value={formatCurrency(stockValue, currency)} />
        <StatCard title="Low-stock items" value={lowStock.length.toLocaleString()} />
        <StatCard title="Movements logged" value={totalMovements.toLocaleString()} />
      </div>

      <LineChart title="Inbound units (last 12 months)" points={inboundSeries} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Top items by stock value"
          series={topByValue.slice(0, 8)}
          formatValue={(v) => formatCurrency(v, currency)}
          emptyHint="No stock on hand."
        />
        <BarList
          title="Movements by type"
          series={TYPES.map((t) => ({ label: t, value: typeCounts.get(t) ?? 0 }))}
        />
      </div>

      <BarList title="Items at or below reorder point" series={lowStock.slice(0, 12)} emptyHint="All items above reorder point." />
    </div>
  );
}
