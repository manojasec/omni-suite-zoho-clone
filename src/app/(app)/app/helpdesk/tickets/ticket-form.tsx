"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const STATUSES = ["OPEN", "PENDING", "ON_HOLD", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const CHANNELS = ["web", "email", "phone", "chat", "portal"] as const;

type Initial = {
  subject?: string;
  description?: string | null;
  status?: (typeof STATUSES)[number];
  priority?: (typeof PRIORITIES)[number];
  requesterContactId?: string | null;
  assigneeId?: string | null;
  channel?: string;
  tags?: string[];
};

export function TicketForm({
  action,
  initial,
  contacts,
  members,
  submitLabel = "Save",
  hideStatus = false,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: Initial;
  contacts: { id: string; name: string }[];
  members: { id: string; name: string }[];
  submitLabel?: string;
  hideStatus?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await action(fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            router.refresh();
          }
        })
      }
      className="space-y-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label htmlFor="subject">Subject *</Label>
          <Input id="subject" name="subject" required defaultValue={initial?.subject ?? ""} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={initial?.description ?? ""}
            placeholder="What is the customer reporting?"
          />
        </div>
        {!hideStatus ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={initial?.status ?? "OPEN"}
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <Label htmlFor="priority">Priority</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={initial?.priority ?? "MEDIUM"}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="channel">Channel</Label>
          <select
            id="channel"
            name="channel"
            defaultValue={initial?.channel ?? "web"}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="requesterContactId">Requester</Label>
          <select
            id="requesterContactId"
            name="requesterContactId"
            defaultValue={initial?.requesterContactId ?? ""}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— No contact</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="assigneeId">Assignee</Label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={initial?.assigneeId ?? ""}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">— Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" name="tags" defaultValue={(initial?.tags ?? []).join(", ")} />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
