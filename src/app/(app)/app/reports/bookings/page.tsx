import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export default async function BookingsAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStatus, byHost, recent, total, hosts, byType, types] = await Promise.all([
    prisma.booking.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["hostId"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: { workspaceId: wsId, startsAt: { gte: months[0].from } },
      select: { startsAt: true, status: true },
    }),
    prisma.booking.count({ where: { workspaceId: wsId } }),
    prisma.user.findMany({
      where: { hostedBookings: { some: { workspaceId: wsId } } },
      select: { id: true, name: true, email: true },
    }),
    prisma.booking.groupBy({ by: ["bookingTypeId"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.bookingType.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true } }),
  ]);

  const sCounts = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const completed = sCounts.get("COMPLETED") ?? 0;
  const noShow = sCounts.get("NO_SHOW") ?? 0;
  const completedSample = completed + noShow + (sCounts.get("CANCELLED") ?? 0);
  const noShowRate = completedSample > 0 ? Math.round((noShow / completedSample) * 100) : 0;

  const monthly = bucketByMonth(
    recent.map((r) => ({ createdAt: r.startsAt })),
    months,
  );

  const hostName = new Map(hosts.map((h) => [h.id, h.name ?? h.email]));
  const hostSeries = byHost
    .map((b) => ({ label: hostName.get(b.hostId) ?? "Unknown", value: b._count._all }))
    .sort((a, b) => b.value - a.value);

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const typeSeries = byType
    .map((b) => ({ label: typeName.get(b.bookingTypeId) ?? "Unknown", value: b._count._all }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Bookings analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Total bookings" value={total.toLocaleString()} />
        <StatCard title="Scheduled" value={(sCounts.get("SCHEDULED") ?? 0).toLocaleString()} />
        <StatCard title="Completed" value={completed.toLocaleString()} />
        <StatCard title="No-show rate" value={`${noShowRate}%`} hint={`${noShow} no-shows`} />
      </div>

      <LineChart title="Bookings over time (last 12 months)" points={monthly} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="By status" series={STATUSES.map((s) => ({ label: s, value: sCounts.get(s) ?? 0 }))} />
        <BarList title="By host" series={hostSeries.slice(0, 10)} />
        <BarList title="By booking type" series={typeSeries.slice(0, 10)} />
      </div>
    </div>
  );
}
