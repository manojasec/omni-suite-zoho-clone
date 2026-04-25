"use client";

import { useState, useTransition } from "react";
import { updateWorkspaceAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function WorkspaceForm({
  initial,
  canEdit,
}: {
  initial: { name: string; currency: string; timezone: string };
  canEdit: boolean;
}) {
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateWorkspaceAction(fd);
          setMsg(res ?? null);
        })
      }
      className="grid gap-4 md:grid-cols-2"
    >
      <div className="md:col-span-2 flex flex-col gap-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={initial.name} required disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="currency">Currency (ISO)</Label>
        <Input id="currency" name="currency" defaultValue={initial.currency} maxLength={3} required disabled={!canEdit} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue={initial.timezone} required disabled={!canEdit} />
      </div>
      {msg?.error ? <p className="md:col-span-2 text-sm text-destructive">{msg.error}</p> : null}
      {msg?.ok ? <p className="md:col-span-2 text-sm text-green-700">Saved.</p> : null}
      {canEdit ? (
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      ) : (
        <p className="md:col-span-2 text-xs text-muted-foreground">Only Owners and Admins can edit workspace settings.</p>
      )}
    </form>
  );
}
