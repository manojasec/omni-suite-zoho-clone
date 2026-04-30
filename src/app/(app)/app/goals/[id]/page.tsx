import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  GOAL_STATUSES,
  KEY_RESULT_UNITS,
  formatGoalStatus,
  goalStatusColor,
  keyResultProgress,
  type GoalStatus,
  type KeyResultUnit,
} from "@/modules/goals/schemas";
import { deleteGoalAction, updateGoalAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "goal", "view");
  const canEdit = can(ctx.role, "goal", "edit");
  const canDelete = can(ctx.role, "goal", "delete");

  const [goal, parents, members, children] = await Promise.all([
    prisma.goal.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { keyResults: { orderBy: { position: "asc" } } },
    }),
    prisma.goal.findMany({
      where: { workspaceId: ctx.workspaceId, NOT: { id } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 200,
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 500,
    }),
    prisma.goal.findMany({
      where: { workspaceId: ctx.workspaceId, parentId: id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, progress: true, status: true },
    }),
  ]);
  if (!goal) notFound();

  const status = goal.status as GoalStatus;
  const pct = Math.max(0, Math.min(100, Number(goal.progress)));

  return (
    <div className="space-y-4">
      <p>
        <Link href="/app/goals" className="text-xs text-muted-foreground hover:underline">
          ← Goals
        </Link>
      </p>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${goalStatusColor(status)}`}
            >
              {formatGoalStatus(status)}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
          </div>
        </div>
        <div className="w-48">
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-right text-xs text-muted-foreground">
            {pct.toFixed(0)}%
          </div>
        </div>
      </div>

      {children.length > 0 ? (
        <Card className="p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Sub-goals
          </h2>
          <ul className="space-y-1 text-sm">
            {children.map((c) => (
              <li key={c.id}>
                <Link href={`/app/goals/${c.id}`} className="hover:underline">
                  {c.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {Number(c.progress).toFixed(0)}% · {formatGoalStatus(c.status as GoalStatus)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <form action={updateGoalAction.bind(null, goal.id)} className="space-y-4">
        <Card className="space-y-3 p-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={goal.title}
              required
              maxLength={200}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={goal.description ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                defaultValue={status}
                disabled={!canEdit}
              >
                {GOAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatGoalStatus(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Start</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  goal.startDate ? goal.startDate.toISOString().slice(0, 10) : ""
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={
                  goal.dueDate ? goal.dueDate.toISOString().slice(0, 10) : ""
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="parentId">Parent goal</Label>
              <Select
                id="parentId"
                name="parentId"
                defaultValue={goal.parentId ?? ""}
                disabled={!canEdit}
              >
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
              <Select
                id="ownerId"
                name="ownerId"
                defaultValue={goal.ownerId ?? ""}
                disabled={!canEdit}
              >
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
                <th className="pb-2 w-16 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...goal.keyResults,
                ...Array(Math.max(0, 5 - goal.keyResults.length)).fill(null),
              ].map((kr, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="py-1 pr-2">
                    <Input
                      name="kr.title"
                      defaultValue={kr?.title ?? ""}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Select
                      name="kr.unit"
                      defaultValue={kr ? (kr.unit as KeyResultUnit) : "PERCENT"}
                      disabled={!canEdit}
                    >
                      {KEY_RESULT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      name="kr.start"
                      type="number"
                      step="0.01"
                      defaultValue={kr ? Number(kr.startValue).toString() : "0"}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      name="kr.target"
                      type="number"
                      step="0.01"
                      defaultValue={kr ? Number(kr.targetValue).toString() : "100"}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      name="kr.current"
                      type="number"
                      step="0.01"
                      defaultValue={kr ? Number(kr.currentValue).toString() : "0"}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-1 text-right text-xs text-muted-foreground">
                    {kr
                      ? keyResultProgress({
                          unit: kr.unit as KeyResultUnit,
                          startValue: Number(kr.startValue),
                          targetValue: Number(kr.targetValue),
                          currentValue: Number(kr.currentValue),
                        }).toFixed(0)
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit">Save changes</Button>
          </div>
        ) : null}
      </form>

      {canDelete ? (
        <Card className="p-4">
          <form action={deleteGoalAction.bind(null, goal.id)}>
            <Button type="submit" variant="ghost">
              Delete goal
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
