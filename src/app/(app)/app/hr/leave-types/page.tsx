import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createLeaveTypeAction, archiveLeaveTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
  const ctx = await requireSession();
  const types = await prisma.leaveType.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: { name: "asc" },
  });
  const canCreate = can(ctx.role, "leaveType", "create");
  const canDelete = can(ctx.role, "leaveType", "delete");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leave types</h1>
        <p className="text-sm text-muted-foreground">Configure types of leave available to employees.</p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New leave type</h2>
          <form action={createLeaveTypeAction} className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required placeholder="Annual leave" />
            </div>
            <div>
              <Label htmlFor="daysPerYear">Days per year</Label>
              <Input id="daysPerYear" name="daysPerYear" type="number" min="0" max="366" defaultValue="20" />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="paid" defaultChecked />
                Paid
              </label>
              <Button type="submit" className="ml-auto">Add</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Days/year</th>
              <th className="px-4 py-2 font-medium">Paid</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 tabular-nums">{t.daysPerYear}</td>
                <td className="px-4 py-2">{t.paid ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  {canDelete ? (
                    <form action={archiveLeaveTypeAction.bind(null, t.id)}>
                      <Button type="submit" variant="ghost" size="sm">Archive</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {types.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No leave types yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
