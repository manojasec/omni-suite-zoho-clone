import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  TASK_STATUSES,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABELS,
  computeBar,
  computeRange,
  formatDate,
  summarizeGantt,
  toIsoDate,
} from "@/modules/gantt/schemas";
import {
  createGanttDependencyAction,
  deleteGanttDependencyAction,
  updateGanttTaskAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "gantt", "view");

  const projects = await prisma.project.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });

  const projectId =
    sp.project && projects.some((p) => p.id === sp.project)
      ? sp.project
      : (projects[0]?.id ?? null);

  const [tasks, dependencies] = projectId
    ? await Promise.all([
        prisma.task.findMany({
          where: { workspaceId: ctx.workspaceId, projectId },
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            progress: true,
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
        }),
        prisma.taskDependency.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            predecessor: { projectId },
            successor: { projectId },
          },
          select: {
            id: true,
            predecessorId: true,
            successorId: true,
            predecessor: { select: { title: true } },
            successor: { select: { title: true } },
          },
        }),
      ])
    : [[], []];

  const summary = summarizeGantt(tasks);
  const range = computeRange(tasks);
  const canEdit = can(ctx.role, "gantt", "edit");
  const colWidth = 28;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gantt</h1>
          <p className="text-sm text-muted-foreground">
            Schedule tasks and dependencies across a project timeline.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <div>
            <Label htmlFor="project">Project</Label>
            <Select
              id="project"
              name="project"
              defaultValue={projectId ?? ""}
            >
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm" variant="outline">
            View
          </Button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(
          [
            ["Total", summary.total],
            ["Scheduled", summary.scheduled],
            ["Unscheduled", summary.unscheduled],
            ["Done", summary.done],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </Card>
        ))}
      </div>

      {!projectId ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Pick a project above to view its Gantt chart.
        </Card>
      ) : tasks.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          This project has no tasks yet.
        </Card>
      ) : (
        <Card className="p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="sticky left-0 bg-card px-2 py-1 font-medium">
                    Task
                  </th>
                  <th className="px-2 py-1 font-medium">Status</th>
                  <th className="px-2 py-1 font-medium">Start</th>
                  <th className="px-2 py-1 font-medium">End</th>
                  <th className="px-2 py-1 font-medium">Progress</th>
                  <th className="px-2 py-1 font-medium">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const bar = range ? computeBar(t, range) : null;
                  return (
                    <tr key={t.id} className="border-t align-top">
                      <td className="sticky left-0 bg-card px-2 py-2">
                        <div className="font-medium">{t.title}</div>
                        {t.assignee ? (
                          <div className="text-[10px] text-muted-foreground">
                            {t.assignee.name ?? t.assignee.email}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          {TASK_STATUS_LABELS[t.status]}
                        </span>
                      </td>
                      <td className="px-2 py-2">{formatDate(t.startAt)}</td>
                      <td className="px-2 py-2">{formatDate(t.endAt)}</td>
                      <td className="px-2 py-2">{t.progress}%</td>
                      <td className="px-2 py-2">
                        {range && bar ? (
                          <div
                            className="relative h-5 rounded bg-muted/50"
                            style={{ width: `${range.days * colWidth}px` }}
                          >
                            <div
                              className={
                                "absolute inset-y-0 rounded " +
                                TASK_STATUS_COLOR[t.status]
                              }
                              style={{
                                left: `${bar.offsetDays * colWidth}px`,
                                width: `${bar.spanDays * colWidth}px`,
                                opacity: 0.85,
                              }}
                              title={`${formatDate(t.startAt)} → ${formatDate(t.endAt)}`}
                            >
                              <div
                                className="h-full rounded bg-foreground/30"
                                style={{ width: `${t.progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            unscheduled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {range ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {formatDate(range.min)} → {formatDate(range.max)} ({range.days}{" "}
              days)
            </div>
          ) : null}
        </Card>
      )}

      {projectId && tasks.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {canEdit ? (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Schedule a task</h2>
              <p className="mb-2 text-xs text-muted-foreground">
                Set start, end, and progress for any task in this project.
              </p>
              <div className="space-y-3">
                {tasks.map((t) => (
                  <form
                    key={t.id}
                    action={updateGanttTaskAction.bind(null, t.id)}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 border-t pt-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {TASK_STATUS_LABELS[t.status]}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`s-${t.id}`}>Start</Label>
                      <Input
                        id={`s-${t.id}`}
                        type="date"
                        name="startAt"
                        defaultValue={toIsoDate(t.startAt)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`e-${t.id}`}>End</Label>
                      <Input
                        id={`e-${t.id}`}
                        type="date"
                        name="endAt"
                        defaultValue={toIsoDate(t.endAt)}
                      />
                    </div>
                    <div className="w-16">
                      <Label htmlFor={`p-${t.id}`}>%</Label>
                      <Input
                        id={`p-${t.id}`}
                        type="number"
                        name="progress"
                        min={0}
                        max={100}
                        defaultValue={t.progress}
                      />
                    </div>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Dependencies</h2>
            {dependencies.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No dependencies yet.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {dependencies.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      <strong>{d.predecessor.title}</strong>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <strong>{d.successor.title}</strong>
                    </span>
                    {canEdit ? (
                      <form
                        action={deleteGanttDependencyAction.bind(null, d.id)}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <form
                action={createGanttDependencyAction}
                className="mt-3 grid gap-2 border-t pt-3 text-xs"
              >
                <div>
                  <Label htmlFor="predecessorId">Predecessor</Label>
                  <Select id="predecessorId" name="predecessorId" required>
                    <option value="">—</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="successorId">Successor</Label>
                  <Select id="successorId" name="successorId" required>
                    <option value="">—</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    Add dependency
                  </Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {TASK_STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span
              className={"inline-block h-2 w-3 rounded " + TASK_STATUS_COLOR[s]}
            />
            {TASK_STATUS_LABELS[s]}
          </span>
        ))}
        <Link href="/app/projects" className="ml-auto hover:underline">
          Manage projects →
        </Link>
      </div>
    </div>
  );
}
