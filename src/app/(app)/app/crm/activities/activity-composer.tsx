"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createActivityAction } from "./actions";

type Props = { contactId?: string; dealId?: string };

const TYPES = [
  { value: "NOTE", label: "Note" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "EMAIL", label: "Email" },
  { value: "TASK", label: "Task" },
];

export function ActivityComposer({ contactId, dealId }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6">
        {!open ? (
          <Button onClick={() => setOpen(true)} variant="outline">+ Log activity</Button>
        ) : (
          <form
            action={(fd) =>
              start(async () => {
                if (contactId) fd.set("contactId", contactId);
                if (dealId) fd.set("dealId", dealId);
                const res = await createActivityAction(fd);
                if (res && "error" in res && res.error) setError(res.error);
                else {
                  setError(null);
                  setOpen(false);
                  (document.getElementById("activity-form") as HTMLFormElement | null)?.reset();
                }
              })
            }
            id="activity-form"
            className="grid gap-3 md:grid-cols-2"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue="NOTE">
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueAt">Due (optional)</Label>
              <Input id="dueAt" name="dueAt" type="datetime-local" />
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required maxLength={200} />
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <Label htmlFor="body">Details</Label>
              <Textarea id="body" name="body" rows={3} maxLength={5000} />
            </div>
            {error ? <p className="md:col-span-2 text-sm text-destructive">{error}</p> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add"}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
