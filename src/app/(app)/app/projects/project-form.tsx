"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

type Initial = {
  name?: string;
  description?: string | null;
  status?: (typeof STATUSES)[number];
  startDate?: string | null;
  endDate?: string | null;
  budgetHours?: number | null;
  budgetAmount?: string | null;
};

export function ProjectForm({
  action,
  initial,
  submitLabel = "Save",
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: Initial;
  submitLabel?: string;
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
          <Label htmlFor="name">Name *</Label>
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ""} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "PLANNING"}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div />
        <div className="flex flex-col gap-1">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={initial?.startDate ? initial.startDate.slice(0, 10) : ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={initial?.endDate ? initial.endDate.slice(0, 10) : ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="budgetHours">Budget (hours)</Label>
          <Input
            id="budgetHours"
            name="budgetHours"
            type="number"
            min="0"
            defaultValue={initial?.budgetHours ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="budgetAmount">Budget (amount)</Label>
          <Input
            id="budgetAmount"
            name="budgetAmount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.budgetAmount ?? ""}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
