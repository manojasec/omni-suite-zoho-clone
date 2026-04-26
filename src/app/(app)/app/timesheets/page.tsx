import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  formatDateTime,
  formatDuration,
  groupByDay,
  isoDateKey,
  startOfDay,
  summarizeEntries,
  toDateTimeLocal,
  toHours,
} from "@/modules/time-tracking/schemas";
import {
  createManualEntryAction,
  deleteTimeEntryAction,
  startTimerAction,
  stopTimerAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; project?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "timeEntry", "view");

  const today = startOfDay(new Date());
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 6);
  const fromKey = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
    ? sp.from
    : isoDateKey(defaultFrom);
  const toKey = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)
    ? sp.to
    : isoDateKey(today);
  const projectFilter = sp.project ?? undefined;

  const fromDate = startOfDay(fromKey);
  const toDate = startOfDay(toKey);
  toDate.setHours(23, 59, 59, 999);

  const [running, entries, projects, tasks] = await Promise.all([
    prisma.timeEntry.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        endedAt: null,
      },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        startedAt: { gte: fromDate, lte: toDate },
        ...(projectFilter ? { projectId: projectFilter } : {}),
      },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 500,
    }),
    prisma.project.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, title: true, projectId: true },
      orderBy: { title: "asc" },
      take: 500,
    }),
  ]);

  const summary = summarizeEntries(entries);
  const grouped = groupByDay(
    entries.map((e) => ({
      id: e.id,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
      durationSec: e.durationSec,
      billable: e.billable,
      description: e.description,
    })),
  );
  const entriesById = new Map(entries.map((e) => [e.id, e] as const));

  const canCreate = can(ctx.role, "timeEntry", "create");
  const canEdit = can(ctx.role, "timeEntry", "edit");
  const canDelete = can(ctx.role, "timeEntry", "delete");

  const projectsById = new Map(projects.map((p) => [p.id, p] as const));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
          <p className="text-sm text-muted-foreground">
            Track time with timers or manual entries. Roll up hours by day.
          </p>
        </div>
      </div>

      {canCreate ? (
        <Card className="p-4">
          {running ? (
            <form
              action={stopTimerAction.bind(null, running.id)}
              className="flex flex-wrap items-center gap-3"
            >
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {running.description || "Tracking time"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {running.task?.title ?? "No task"}
                  {running.project ? ` · ${running.project.name}` : ""} · started{" "}
                  {formatDateTime(running.startedAt)}
                </div>
              </div>
              <Button type="submit" size="sm">
                Stop
              </Button>
            </form>
          ) : (
            <form
              action={startTimerAction}
              className="grid gap-2 md:grid-cols-[1fr_220px_220px_auto_auto]"
            >
              <div>
                <Label htmlFor="description">What are you working on?</Label>
                <Input
                  id="description"
                  name="description"
                  maxLength={500}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <Label htmlFor="projectId">Project</Label>
                <Select id="projectId" name="projectId" defaultValue="">
                  <option value="">— None —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="taskId">Task</Label>
                <Select id="taskId" name="taskId" defaultValue="">
                  <option value="">— None —</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {t.projectId
                        ? ` · ${projectsById.get(t.projectId)?.name ?? ""}`
                        : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-end gap-1 text-xs">
                <input
                  type="checkbox"
                  name="billable"
                  defaultChecked
                  className="h-4 w-4"
                />
                Billable
              </label>
              <div className="flex items-end">
                <Button type="submit" size="sm">
                  Start timer
                </Button>
              </div>
            </form>
          )}
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {(
          [
            ["Total", formatDuration(summary.totalSec)],
            ["Billable", formatDuration(summary.billableSec)],
            ["Non-billable", formatDuration(summary.nonBillableSec)],
            ["Entries", String(summary.count)],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </Card>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-2 text-xs">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" name="from" defaultValue={fromKey} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" name="to" defaultValue={toKey} />
        </div>
        <div className="min-w-[200px]">
          <Label htmlFor="project">Project</Label>
          <Select
            id="project"
            name="project"
            defaultValue={projectFilter ?? ""}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
        {sp.from || sp.to || sp.project ? (
          <Link
            href="/app/timesheets"
            className="text-muted-foreground hover:underline"
          >
            Reset
          </Link>
        ) : null}
      </form>

      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No time entries in this range.
            </Card>
          ) : (
            grouped.map((day) => (
              <Card key={day.date} className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1">
                  <h2 className="text-sm font-semibold">
                    {new Date(day.date).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </h2>
                  <div className="text-sm font-mono text-muted-foreground">
                    {formatDuration(day.totalSec)} ({toHours(day.totalSec)}h)
                  </div>
                </div>
                <ul className="divide-y text-xs">
                  {day.entries.map((e) => {
                    const full = entriesById.get(e.id);
                    return (
                      <li
                        key={e.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">
                            {e.description || (
                              <span className="text-muted-foreground">
                                (no description)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {full?.task?.title ?? "No task"}
                            {full?.project ? ` · ${full.project.name}` : ""}
                            {" · "}
                            {formatDateTime(e.startedAt)} →{" "}
                            {e.endedAt ? formatDateTime(e.endedAt) : "running"}
                            {e.billable ? "" : " · non-billable"}
                          </div>
                        </div>
                        <div className="font-mono text-sm">
                          {e.endedAt ? formatDuration(e.durationSec) : "—"}
                        </div>
                        {canDelete && e.endedAt ? (
                          <form
                            action={deleteTimeEntryAction.bind(null, e.id)}
                          >
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                            >
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))
          )}
        </div>

        {canCreate ? (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Add manual entry</h2>
            <form action={createManualEntryAction} className="grid gap-2 text-xs">
              <div>
                <Label htmlFor="m-description">Description</Label>
                <Textarea
                  id="m-description"
                  name="description"
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="m-project">Project</Label>
                  <Select id="m-project" name="projectId" defaultValue="">
                    <option value="">— None —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="m-task">Task</Label>
                  <Select id="m-task" name="taskId" defaultValue="">
                    <option value="">— None —</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="m-start">Start</Label>
                  <Input
                    id="m-start"
                    type="datetime-local"
                    name="startedAt"
                    required
                    defaultValue={toDateTimeLocal(new Date())}
                  />
                </div>
                <div>
                  <Label htmlFor="m-end">End</Label>
                  <Input
                    id="m-end"
                    type="datetime-local"
                    name="endedAt"
                    required
                    defaultValue={toDateTimeLocal(new Date())}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="billable"
                  defaultChecked
                  className="h-4 w-4"
                />
                Billable
              </label>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add entry
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
