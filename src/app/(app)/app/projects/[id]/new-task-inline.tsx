"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createTaskAction } from "../tasks-actions";

export function NewTaskInline({
  projectId,
  members,
}: {
  projectId: string;
  members: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Add task</Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          fd.set("projectId", projectId);
          const res = await createTaskAction(fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            formRef.current?.reset();
            setOpen(false);
            router.refresh();
          }
        })
      }
      className="grid gap-2 rounded-lg border p-3 md:grid-cols-5"
    >
      <div className="md:col-span-2 flex flex-col gap-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="priority">Priority</Label>
        <select id="priority" name="priority" defaultValue="MEDIUM" className="h-9 rounded-md border bg-transparent px-2 text-sm">
          {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="assigneeId">Assignee</Label>
        <select id="assigneeId" name="assigneeId" className="h-9 rounded-md border bg-transparent px-2 text-sm">
          <option value="">— Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="dueAt">Due</Label>
        <Input id="dueAt" name="dueAt" type="date" />
      </div>
      {error ? <p className="md:col-span-5 text-sm text-destructive">{error}</p> : null}
      <div className="md:col-span-5 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add task"}</Button>
      </div>
    </form>
  );
}
