"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { TaskStatus, Priority } from "@prisma/client";
import { moveTaskStatusAction, deleteTaskAction } from "../tasks-actions";
import { Button } from "@/components/ui/button";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "IN_REVIEW", label: "In review" },
  { id: "DONE", label: "Done" },
  { id: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "bg-zinc-100 text-zinc-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800",
  URGENT: "bg-red-100 text-red-700",
};

export type TaskCard = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: string | null;
  assigneeName: string | null;
};

export function TaskBoard({
  initialTasks,
  canEdit,
}: {
  initialTasks: TaskCard[];
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();
  const [tasks, setTasksOptimistic] = useOptimistic(
    initialTasks,
    (state: TaskCard[], move: { id: string; status: TaskStatus }) =>
      state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t)),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    setDraggingId(null);
    startTransition(async () => {
      setTasksOptimistic({ id, status });
      const res = await moveTaskStatusAction({ taskId: id, status });
      if (res && "error" in res && res.error) setError(res.error);
    });
  };

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))` }}
      >
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-lg border bg-card"
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => canEdit && onDrop(col.id, e)}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="text-xs text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2 min-h-[160px]">
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      if (!canEdit) return;
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(t.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`group rounded-md border bg-background p-2 text-sm shadow-sm hover:bg-accent ${
                      draggingId === t.id ? "opacity-50" : ""
                    } ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    <div className="font-medium">{t.title}</div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLOR[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span>{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : ""}</span>
                    </div>
                    {t.assigneeName ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">{t.assigneeName}</div>
                    ) : null}
                    {canEdit ? (
                      <form action={deleteTaskAction.bind(null, t.id)} className="mt-1 hidden group-hover:block">
                        <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-xs">Delete</Button>
                      </form>
                    ) : null}
                  </div>
                ))}
                {colTasks.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">No tasks</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
