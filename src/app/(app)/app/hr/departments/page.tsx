import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createDepartmentAction, archiveDepartmentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const ctx = await requireSession();
  const departments = await prisma.department.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
  const canCreate = can(ctx.role, "department", "create");
  const canDelete = can(ctx.role, "department", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="text-sm text-muted-foreground">Organisational units within your workspace.</p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New department</h2>
          <form action={createDepartmentAction} className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Engineering" />
            </div>
            <Button type="submit">Add department</Button>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Employees</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{d._count.employees}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete ? (
                    <form action={archiveDepartmentAction.bind(null, d.id)}>
                      <Button type="submit" variant="ghost" size="sm">Archive</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {departments.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No departments yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
