import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createLeaveRequestAction } from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const status = params.status?.toUpperCase();

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)
      ? { status: status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" }
      : {}),
  };

  const [requests, employees, leaveTypes] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        leaveType: { select: { name: true } },
      },
      take: 200,
    }),
    prisma.employee.findMany({
      where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }),
    prisma.leaveType.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const canCreate = can(ctx.role, "leaveRequest", "create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leave requests</h1>
        <p className="text-sm text-muted-foreground">Submit and approve time-off requests.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/app/hr/leave" className={`rounded-full border px-3 py-1 ${!status ? "bg-primary text-primary-foreground" : ""}`}>All</Link>
        {(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map((s) => (
          <Link key={s} href={`/app/hr/leave?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : ""}`}>
            {s}
          </Link>
        ))}
      </div>

      {canCreate && employees.length > 0 && leaveTypes.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New leave request</h2>
          <form action={createLeaveRequestAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="employeeId">Employee *</Label>
              <Select id="employeeId" name="employeeId" required defaultValue="">
                <option value="" disabled>— Select —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeNumber})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="leaveTypeId">Type *</Label>
              <Select id="leaveTypeId" name="leaveTypeId" required defaultValue="">
                <option value="" disabled>— Select —</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="days">Days *</Label>
              <Input id="days" name="days" type="number" step="0.5" min="0.5" defaultValue="1" required />
            </div>
            <div>
              <Label htmlFor="startDate">Start *</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div>
              <Label htmlFor="endDate">End *</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" name="reason" rows={2} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Submit request</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Start</th>
              <th className="px-4 py-2 font-medium">End</th>
              <th className="px-4 py-2 font-medium">Days</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-t hover:bg-accent/30">
                <td className="px-4 py-2">
                  <Link href={`/app/hr/leave/${r.id}`} className="font-medium hover:underline">
                    {r.employee.firstName} {r.employee.lastName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.employee.employeeNumber}</div>
                </td>
                <td className="px-4 py-2">{r.leaveType.name}</td>
                <td className="px-4 py-2 tabular-nums">{r.startDate.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2 tabular-nums">{r.endDate.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2 tabular-nums">{Number(r.days).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {requests.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No leave requests.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
