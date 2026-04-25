import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "VIEWED", "COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"] as const;

export default async function EsignAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [byStatus, total, completedRows, recent, signers] = await Promise.all([
    prisma.signatureEnvelope.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.signatureEnvelope.count({ where: { workspaceId: wsId } }),
    prisma.signatureEnvelope.findMany({
      where: { workspaceId: wsId, status: "COMPLETED", completedAt: { not: null } },
      select: { sentAt: true, completedAt: true },
      take: 1000,
    }),
    prisma.signatureEnvelope.findMany({
      where: { workspaceId: wsId, createdAt: { gte: months[0].from } },
      select: { createdAt: true, status: true },
    }),
    prisma.signatureSigner.groupBy({
      by: ["status"],
      where: { envelope: { workspaceId: wsId } },
      _count: { _all: true },
    }),
  ]);

  const sCounts = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const completed = sCounts.get("COMPLETED") ?? 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  let avgHours = 0;
  if (completedRows.length > 0) {
    const samples = completedRows.filter((r) => r.sentAt && r.completedAt);
    if (samples.length > 0) {
      const totalMs = samples.reduce(
        (acc, r) => acc + (r.completedAt!.getTime() - r.sentAt!.getTime()),
        0,
      );
      avgHours = Math.round(totalMs / samples.length / (1000 * 60 * 60));
    }
  }

  const sentSeries = bucketByMonth(
    recent.filter((r) => r.status !== "DRAFT").map((r) => ({ createdAt: r.createdAt })),
    months,
  );

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">E-Signature analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Envelopes" value={total.toLocaleString()} />
        <StatCard title="Completed" value={completed.toLocaleString()} hint={`${completionRate}% completion`} />
        <StatCard title="In flight" value={((sCounts.get("SENT") ?? 0) + (sCounts.get("VIEWED") ?? 0)).toLocaleString()} />
        <StatCard title="Avg time to sign" value={`${avgHours}h`} hint={`${completedRows.length} sample`} />
      </div>

      <LineChart title="Envelopes sent (last 12 months)" points={sentSeries} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Envelopes by status" series={STATUSES.map((s) => ({ label: s, value: sCounts.get(s) ?? 0 }))} />
        <BarList
          title="Signers by status"
          series={signers.map((b) => ({ label: b.status, value: b._count._all })).sort((a, b) => b.value - a.value)}
        />
      </div>
    </div>
  );
}
