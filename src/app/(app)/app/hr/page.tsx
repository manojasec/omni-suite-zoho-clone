import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HrOverviewPage() {
  const ctx = await requireSession();
  const [empCount, deptCount, pendingLeave, leaveTypes] = await Promise.all([
    prisma.employee.count({
      where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } },
    }),
    prisma.department.count({
      where: { workspaceId: ctx.workspaceId, archived: false },
    }),
    prisma.leaveRequest.count({
      where: { workspaceId: ctx.workspaceId, status: "PENDING" },
    }),
    prisma.leaveType.count({
      where: { workspaceId: ctx.workspaceId, archived: false },
    }),
  ]);

  const tiles = [
    { label: "Active employees", value: empCount, href: "/app/hr/employees" },
    { label: "Departments", value: deptCount, href: "/app/hr/departments" },
    { label: "Pending leave", value: pendingLeave, href: "/app/hr/leave?status=PENDING" },
    { label: "Leave types", value: leaveTypes, href: "/app/hr/leave-types" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Human Resources</h1>
        <p className="text-sm text-muted-foreground">
          Manage employees, departments, leave, and attendance.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}>
            <Card className="p-4 hover:bg-accent/40 transition">
              <div className="text-xs uppercase text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{t.value}</div>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="p-6">
        <h2 className="mb-2 text-sm font-semibold">Quick links</h2>
        <ul className="text-sm space-y-1">
          <li><Link className="text-primary hover:underline" href="/app/hr/employees">→ Employees</Link></li>
          <li><Link className="text-primary hover:underline" href="/app/hr/departments">→ Departments</Link></li>
          <li><Link className="text-primary hover:underline" href="/app/hr/leave">→ Leave requests</Link></li>
          <li><Link className="text-primary hover:underline" href="/app/hr/leave-types">→ Leave types</Link></li>
          <li><Link className="text-primary hover:underline" href="/app/hr/attendance">→ Attendance</Link></li>
        </ul>
      </Card>
    </div>
  );
}
