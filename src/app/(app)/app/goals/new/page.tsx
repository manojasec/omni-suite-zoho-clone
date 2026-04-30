import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { GOAL_STATUSES, KEY_RESULT_UNITS, formatGoalStatus } from "@/modules/goals/schemas";
import { createGoalAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewGoalPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "create");

  const [parents, members] = await Promise.all([
    prisma.goal.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 200,
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="space-y-4">
      <p>
        <Link href="/app/goals" className="text-xs text-muted-foreground hover:underline">
          ← Goals
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>

      <form action={createGoalAction} className="space-y-4">
        <Card className="space-y-3 p-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={2000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="ON_TRACK">
                {GOAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatGoalStatus(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
            <div>
              <Label htmlFor="dueDate">Due</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div>
              <Label htmlFor="parentId">Parent goal</Label>
              <Select id="parentId" name="parentId" defaultValue="">
                <option value="">—</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ownerId">Owner</Label>
              <Select id="ownerId" name="ownerId" defaultValue="">
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Key results</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2">Title</th>
                <th className="pb-2 w-28">Unit</th>
                <th className="pb-2 w-24">Start</th>
                <th className="pb-2 w-24">Target</th>
                <th className="pb-2 w-24">Current</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2">
                    <Input name="kr.title" placeholder="Key result" />
                  </td>
                  <td className="py-1 pr-2">
                    <Select name="kr.unit" defaultValue="PERCENT">
                      {KEY_RESULT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input name="kr.start" type="number" step="0.01" defaultValue="0" />
                  </td>
                  <td className="py-1 pr-2">
                    <Input name="kr.target" type="number" step="0.01" defaultValue="100" />
                  </td>
                  <td className="py-1">
                    <Input name="kr.current" type="number" step="0.01" defaultValue="0" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Create goal</Button>
        </div>
      </form>
    </div>
  );
}
