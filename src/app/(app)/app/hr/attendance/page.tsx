import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { recordAttendanceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 14);
  const fromStr = params.from ?? defaultFrom.toISOString().slice(0, 10);
  const toStr = params.to ?? today.toISOString().slice(0, 10);

  const where = {
    workspaceId: ctx.workspaceId,
    date: { gte: new Date(fromStr), lte: new Date(toStr) },
    ...(params.employeeId ? { employeeId: params.employeeId } : {}),
  };

  const [records, employees] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: "desc" }],
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      },
      take: 300,
    }),
    prisma.employee.findMany({
      where: { workspaceId: ctx.workspaceId, status: { not: "TERMINATED" } },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }),
  ]);

  const canCreate = can(ctx.role, "leaveRequest", "create"); // shared HR write capability
  const totalHours = records.reduce((sum, r) => sum + Number(r.hours), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Daily attendance log · {records.length} records · {totalHours.toFixed(2)} total hours
        </p>
      </div>

      <Card className="p-4">
        <form className="flex flex-wrap gap-3 items-end" method="get">
          <div>
            <Label htmlFor="employeeId">Employee</Label>
            <Select id="employeeId" name="employeeId" defaultValue={params.employeeId ?? ""}>
              <option value="">All</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={fromStr} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={toStr} />
          </div>
          <Button type="submit" variant="outline" size="sm">Filter</Button>
        </form>
      </Card>

      {canCreate && employees.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Record attendance</h2>
          <form action={recordAttendanceAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="employeeId-rec">Employee *</Label>
              <Select id="employeeId-rec" name="employeeId" required defaultValue="">
                <option value="" disabled>— Select —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input id="date" name="date" type="date" required
                defaultValue={today.toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input id="hours" name="hours" type="number" step="0.25" min="0" max="24" defaultValue="0" />
            </div>
            <div>
              <Label htmlFor="checkIn">Check-in</Label>
              <Input id="checkIn" name="checkIn" type="time" />
            </div>
            <div>
              <Label htmlFor="checkOut">Check-out</Label>
              <Input id="checkOut" name="checkOut" type="time" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" name="note" rows={2} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Save record</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Check-in</th>
              <th className="px-4 py-2 font-medium">Check-out</th>
              <th className="px-4 py-2 font-medium">Hours</th>
              <th className="px-4 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 tabular-nums">{r.date.toISOString().slice(0, 10)}</td>
                <td className="px-4 py-2">
                  <Link href={`/app/hr/employees/${r.employeeId}`} className="hover:underline">
                    {r.employee.firstName} {r.employee.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  {r.checkIn ? r.checkIn.toISOString().slice(11, 16) : "—"}
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  {r.checkOut ? r.checkOut.toISOString().slice(11, 16) : "—"}
                </td>
                <td className="px-4 py-2 tabular-nums">{Number(r.hours).toFixed(2)}</td>
                <td className="px-4 py-2 text-muted-foreground truncate max-w-xs">{r.note ?? "—"}</td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No records in this range.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
