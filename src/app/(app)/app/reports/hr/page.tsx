import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { StatCard, BarList } from "@/components/analytics/charts";

export const dynamic = "force-dynamic";

const EMP_STATUSES = ["ACTIVE", "ON_LEAVE", "TERMINATED"] as const;
const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const EMP_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;

export default async function HrAnalyticsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "report", "view");
  const wsId = ctx.workspaceId;

  const [byStatus, byType, byDept, leaveByStatus, leaveByType, totalEmployees, departments] = await Promise.all([
    prisma.employee.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["employmentType"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { workspaceId: wsId, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.leaveRequest.groupBy({ by: ["status"], where: { workspaceId: wsId }, _count: { _all: true } }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { workspaceId: wsId, status: "APPROVED" },
      _sum: { days: true },
    }),
    prisma.employee.count({ where: { workspaceId: wsId } }),
    prisma.department.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true } }),
  ]);

  const leaveTypes = await prisma.leaveType.findMany({ where: { workspaceId: wsId }, select: { id: true, name: true } });

  const sCounts = new Map(byStatus.map((b) => [b.status, b._count._all]));
  const tCounts = new Map(byType.map((b) => [b.employmentType, b._count._all]));
  const lCounts = new Map(leaveByStatus.map((b) => [b.status, b._count._all]));

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const deptSeries = byDept
    .map((b) => ({
      label: b.departmentId ? deptName.get(b.departmentId) ?? "Unknown" : "Unassigned",
      value: b._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  const ltName = new Map(leaveTypes.map((l) => [l.id, l.name]));
  const leaveTypeSeries = leaveByType
    .map((b) => ({ label: ltName.get(b.leaveTypeId) ?? "Unknown", value: Number(b._sum.days ?? 0) }))
    .sort((a, b) => b.value - a.value);

  const active = sCounts.get("ACTIVE") ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/app/reports" className="text-sm text-muted-foreground hover:underline">← Analytics</Link>
      <h1 className="text-2xl font-semibold tracking-tight">HR analytics</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard title="Total employees" value={totalEmployees.toLocaleString()} />
        <StatCard title="Active" value={active.toLocaleString()} />
        <StatCard title="On leave" value={(sCounts.get("ON_LEAVE") ?? 0).toLocaleString()} />
        <StatCard title="Pending leave requests" value={(lCounts.get("PENDING") ?? 0).toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Headcount by department (active)"
          series={deptSeries}
          emptyHint="No active employees yet."
        />
        <BarList
          title="Employees by employment type"
          series={EMP_TYPES.map((t) => ({ label: t, value: tCounts.get(t) ?? 0 }))}
        />
        <BarList
          title="Leave requests by status"
          series={LEAVE_STATUSES.map((s) => ({ label: s, value: lCounts.get(s) ?? 0 }))}
        />
        <BarList
          title="Approved leave days by type"
          series={leaveTypeSeries}
          formatValue={(v) => `${v.toFixed(1)}d`}
          emptyHint="No approved leave yet."
        />
        <BarList
          title="Employees by status"
          series={EMP_STATUSES.map((s) => ({ label: s, value: sCounts.get(s) ?? 0 }))}
        />
      </div>
    </div>
  );
}
