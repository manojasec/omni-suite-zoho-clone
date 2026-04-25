"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export function CampaignForm({
  action,
  audiences,
  initial,
  submitLabel = "Save",
  disabled = false,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  audiences: { id: string; name: string }[];
  initial?: { name?: string; audienceId?: string | null; subject?: string; html?: string };
  submitLabel?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [html, setHtml] = useState(initial?.html ?? "");

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
        <Label htmlFor="name">Campaign name *</Label>
        <Input id="name" name="name" required defaultValue={initial?.name ?? ""} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="audienceId">Audience</Label>
        <select
          id="audienceId"
          name="audienceId"
          defaultValue={initial?.audienceId ?? ""}
          disabled={disabled}
          className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        >
          <option value="">— None —</option>
          {audiences.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="subject">Subject *</Label>
        <Input id="subject" name="subject" required defaultValue={initial?.subject ?? ""} disabled={disabled} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="html">HTML body *</Label>
          <Textarea
            id="html"
            name="html"
            required
            rows={12}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            disabled={disabled}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label>Preview</Label>
          <div
            className="min-h-[14rem] rounded-md border bg-white p-3 text-sm"
            // eslint-disable-next-line react/no-danger -- preview of the user's own draft, scoped to authenticated authors only
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || disabled}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
