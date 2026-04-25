import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createEmployeeAction } from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ON_LEAVE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  TERMINATED: "bg-muted text-muted-foreground",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; departmentId?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const status = params.status?.toUpperCase();

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && ["ACTIVE", "ON_LEAVE", "TERMINATED"].includes(status)
      ? { status: status as "ACTIVE" | "ON_LEAVE" | "TERMINATED" }
      : {}),
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
  };

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ status: "asc" }, { lastName: "asc" }],
      include: { department: { select: { name: true } } },
      take: 200,
    }),
    prisma.department.findMany({
      where: { workspaceId: ctx.workspaceId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const canCreate = can(ctx.role, "employee", "create");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            All people in your workspace ({employees.length})
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link className="text-muted-foreground hover:underline self-center" href="/app/hr/departments">
            Departments →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/app/hr/employees" className={`rounded-full border px-3 py-1 ${!status ? "bg-primary text-primary-foreground" : ""}`}>All</Link>
        {(["ACTIVE", "ON_LEAVE", "TERMINATED"] as const).map((s) => (
          <Link key={s} href={`/app/hr/employees?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : ""}`}>
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New employee</h2>
          <form action={createEmployeeAction} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="employeeNumber">Employee # *</Label>
              <Input id="employeeNumber" name="employeeNumber" required placeholder="EMP-001" />
            </div>
            <div>
              <Label htmlFor="firstName">First name *</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div>
              <Label htmlFor="lastName">Last name *</Label>
              <Input id="lastName" name="lastName" required />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" />
            </div>
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" name="departmentId" defaultValue="">
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="employmentType">Employment type</Label>
              <Select id="employmentType" name="employmentType" defaultValue="FULL_TIME">
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="hireDate">Hire date *</Label>
              <Input id="hireDate" name="hireDate" type="date" required
                defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Add employee</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Job title</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Hire date</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t hover:bg-accent/30">
                <td className="px-4 py-2">
                  <Link href={`/app/hr/employees/${e.id}`} className="font-medium hover:underline">
                    {e.firstName} {e.lastName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{e.employeeNumber} · {e.email}</div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{e.department?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.jobTitle ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[e.status]}`}>
                    {e.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground tabular-nums">
                  {e.hireDate.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
            {employees.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No employees yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
