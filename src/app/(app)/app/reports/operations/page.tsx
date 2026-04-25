import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList, LineChart } from "@/components/analytics/charts";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

export const dynamic = "force-dynamic";

const CHAT_STATUSES = ["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"] as const;
const MAIL_FOLDERS = ["INBOX", "SENT", "DRAFTS", "ARCHIVE", "TRASH"] as const;
const WORKFLOW_STATUSES = ["DRAFT", "ACTIVE", "PAUSED"] as const;
const ENROLLMENT_STATUSES = ["ACTIVE", "COMPLETED", "EXITED"] as const;

export default async function OperationsAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;
  const months = lastNMonths(12);

  const [
    chatByStatus,
    chatRecent,
    chatTotal,
    chatResolved,
    mailByFolder,
    mailUnread,
    mailRecent,
    workflowsByStatus,
    enrollByStatus,
  ] = await Promise.all([
    prisma.chatConversation.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.chatConversation.findMany({
      where: { workspaceId: wsId, createdAt: { gte: months[0].from } },
      select: { createdAt: true },
    }),
    prisma.chatConversation.count({ where: { workspaceId: wsId } }),
    prisma.chatConversation.findMany({
      where: { workspaceId: wsId, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 500,
    }),
    prisma.mailThread.groupBy({ by: ["folder"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.mailThread.count({ where: { workspaceId: wsId, isUnread: true, folder: "INBOX" } }),
    prisma.mailMessage.findMany({
      where: { workspaceId: wsId, createdAt: { gte: months[0].from } },
      select: { createdAt: true, direction: true },
    }),
    prisma.workflow.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.workflowEnrollment.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
  ]);

  const csCounts = new Map(chatByStatus.map((b) => [b.status, b._count._all]));
  const mfCounts = new Map(mailByFolder.map((b) => [b.folder, b._count._all]));
  const wsCounts = new Map(workflowsByStatus.map((b) => [b.status, b._count._all]));
  const esCounts = new Map(enrollByStatus.map((b) => [b.status, b._count._all]));

  let avgChatHours = 0;
  if (chatResolved.length > 0) {
    const totalMs = chatResolved.reduce(
      (acc, r) => acc + (r.resolvedAt!.getTime() - r.createdAt.getTime()),
      0,
    );
    avgChatHours = Math.round(totalMs / chatResolved.length / (1000 * 60 * 60));
  }

  const chatMonthly = bucketByMonth(chatRecent.map((r) => ({ createdAt: r.createdAt })), months);
  const mailInbound = bucketByMonth(
    mailRecent.filter((m) => m.direction === "INBOUND").map((m) => ({ createdAt: m.createdAt })),
    months,
  );
  const mailOutbound = bucketByMonth(
    mailRecent.filter((m) => m.direction === "OUTBOUND").map((m) => ({ createdAt: m.createdAt })),
    months,
  );

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Operations analytics</h1>
      <p className="text-sm text-muted-foreground">Chat, mail, and automation rolled up.</p>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Chat conversations" value={chatTotal.toLocaleString()} />
        <StatCard title="Open chats" value={((csCounts.get("OPEN") ?? 0) + (csCounts.get("ASSIGNED") ?? 0)).toLocaleString()} />
        <StatCard title="Avg chat resolution" value={`${avgChatHours}h`} hint={`${chatResolved.length} sample`} />
        <StatCard title="Unread inbox mail" value={mailUnread.toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title="Chat conversations / month" points={chatMonthly} />
        <LineChart title="Inbound mail / month" points={mailInbound} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Chat by status" series={CHAT_STATUSES.map((s) => ({ label: s, value: csCounts.get(s) ?? 0 }))} />
        <BarList title="Mail by folder" series={MAIL_FOLDERS.map((f) => ({ label: f, value: mfCounts.get(f) ?? 0 }))} />
        <BarList title="Workflows by status" series={WORKFLOW_STATUSES.map((s) => ({ label: s, value: wsCounts.get(s) ?? 0 }))} />
        <BarList title="Enrollments by status" series={ENROLLMENT_STATUSES.map((s) => ({ label: s, value: esCounts.get(s) ?? 0 }))} />
      </div>

      <LineChart title="Outbound mail / month" points={mailOutbound} />
    </div>
  );
}
