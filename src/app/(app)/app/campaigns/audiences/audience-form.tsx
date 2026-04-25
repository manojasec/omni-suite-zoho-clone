"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const STAGES = ["LEAD", "MQL", "SQL", "CUSTOMER", "CHURNED"] as const;

export function AudienceForm({
  action,
  initial,
  submitLabel = "Save",
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: { name?: string; stage?: string[]; tags?: string[]; hasEmail?: boolean };
  submitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const initialStages = new Set(initial?.stage ?? []);

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
      <div className="space-y-1">
        <Label htmlFor="name">Audience name *</Label>
        <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
      </div>

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Filter contacts</legend>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Lifecycle stage (any of)</Label>
          <div className="mt-1 flex flex-wrap gap-3">
            {STAGES.map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="stage" value={s} defaultChecked={initialStages.has(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tags">Tags (comma-separated, contact must have any)</Label>
          <Textarea id="tags" name="tags" rows={2} defaultValue={(initial?.tags ?? []).join(", ")} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hasEmail" defaultChecked={initial?.hasEmail ?? true} />
          Only contacts with an email address
        </label>
      </fieldset>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
