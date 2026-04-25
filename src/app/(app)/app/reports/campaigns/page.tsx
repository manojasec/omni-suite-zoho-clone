import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"] as const;

export default async function CampaignsAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const [byStatus, totalAudiences, totalCampaigns] = await Promise.all([
    prisma.campaign.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.audience.count({ where: { workspaceId: wsId } }),
    prisma.campaign.count({ where: { workspaceId: wsId } }),
  ]);

  const map = new Map(byStatus.map((b) => [b.status, b._count._all]));

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Campaign analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Campaigns" value={totalCampaigns.toLocaleString()} />
        <StatCard title="Audiences" value={totalAudiences.toLocaleString()} />
        <StatCard title="Sent" value={(map.get("SENT") ?? 0).toLocaleString()} />
        <StatCard title="Scheduled" value={(map.get("SCHEDULED") ?? 0).toLocaleString()} />
      </div>

      <BarList
        title="Campaigns by status"
        series={STATUSES.map((s) => ({ label: s, value: map.get(s) ?? 0 }))}
      />

      <p className="text-xs text-muted-foreground">
        Open / click / unsubscribe tracking will appear here once a real email
        provider is wired up.
      </p>
    </div>
  );
}
