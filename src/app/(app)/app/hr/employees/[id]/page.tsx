import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { updateEmployeeAction, terminateEmployeeAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const [employee, departments] = await Promise.all([
    prisma.employee.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        department: { select: { name: true } },
        leaveRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { leaveType: { select: { name: true } } },
        },
      },
    }),
    prisma.department.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!employee) notFound();

  const canEdit = can(ctx.role, "employee", "edit");
  const canTerminate = can(ctx.role, "employee", "delete");
  const update = updateEmployeeAction.bind(null, employee.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/app/hr/employees" className="hover:underline">Employees</Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {employee.employeeNumber} · {employee.email}
          </p>
        </div>
        <div className="flex gap-2">
          {canTerminate && employee.status !== "TERMINATED" ? (
            <form action={terminateEmployeeAction.bind(null, employee.id)}>
              <Button type="submit" variant="destructive" size="sm">Terminate</Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Profile</h2>
        <form action={update} className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="employeeNumber">Employee #</Label>
            <Input id="employeeNumber" name="employeeNumber" defaultValue={employee.employeeNumber} disabled={!canEdit} required />
          </div>
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" defaultValue={employee.firstName} disabled={!canEdit} required />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" defaultValue={employee.lastName} disabled={!canEdit} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee.email} disabled={!canEdit} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={employee.phone ?? ""} disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" name="jobTitle" defaultValue={employee.jobTitle ?? ""} disabled={!canEdit} />
          </div>
          <div>
            <Label htmlFor="departmentId">Department</Label>
            <Select id="departmentId" name="departmentId" defaultValue={employee.departmentId ?? ""} disabled={!canEdit}>
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="employmentType">Employment type</Label>
            <Select id="employmentType" name="employmentType" defaultValue={employee.employmentType} disabled={!canEdit}>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={employee.status} disabled={!canEdit}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="TERMINATED">Terminated</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="hireDate">Hire date</Label>
            <Input id="hireDate" name="hireDate" type="date"
              defaultValue={employee.hireDate.toISOString().slice(0, 10)}
              disabled={!canEdit} required />
          </div>
          <div>
            <Label htmlFor="terminationDate">Termination date</Label>
            <Input id="terminationDate" name="terminationDate" type="date"
              defaultValue={employee.terminationDate?.toISOString().slice(0, 10) ?? ""}
              disabled={!canEdit} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} defaultValue={employee.address ?? ""} disabled={!canEdit} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={employee.notes ?? ""} disabled={!canEdit} />
          </div>
          {canEdit ? (
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Save changes</Button>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Recent leave</h2>
        {employee.leaveRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Type</th>
                <th className="py-1 font-medium">Start</th>
                <th className="py-1 font-medium">End</th>
                <th className="py-1 font-medium">Days</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.leaveRequests.map((lr) => (
                <tr key={lr.id} className="border-t">
                  <td className="py-2">
                    <Link className="hover:underline" href={`/app/hr/leave/${lr.id}`}>
                      {lr.leaveType.name}
                    </Link>
                  </td>
                  <td className="py-2 tabular-nums">{lr.startDate.toISOString().slice(0, 10)}</td>
                  <td className="py-2 tabular-nums">{lr.endDate.toISOString().slice(0, 10)}</td>
                  <td className="py-2 tabular-nums">{Number(lr.days).toFixed(2)}</td>
                  <td className="py-2 text-xs">{lr.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
