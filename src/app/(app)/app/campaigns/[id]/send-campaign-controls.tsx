"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function SendCampaignControls({
  campaignId,
  status,
  sendAction,
  cancelAction,
  testAction,
}: {
  campaignId: string;
  status: string;
  sendAction: (fd: FormData) => Promise<{ error?: string; ok?: boolean; recipients?: number } | void>;
  cancelAction: () => Promise<{ error?: string; ok?: boolean } | void>;
  testAction: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (status === "SENT") {
    return <p className="text-sm text-muted-foreground">This campaign has been sent.</p>;
  }

  return (
    <div className="space-y-3">
      <form
        action={(fd) =>
          start(async () => {
            const res = await sendAction(fd);
            if (res && "error" in res && res.error) {
              setError(res.error);
              setInfo(null);
            } else if (res && "ok" in res && res.ok) {
              setError(null);
              setInfo(
                res.recipients !== undefined
                  ? `Queued for ${res.recipients} recipient${res.recipients === 1 ? "" : "s"}.`
                  : "Queued.",
              );
              router.refresh();
            }
          })
        }
        className="space-y-2 rounded-md border p-3"
      >
        <Label htmlFor="scheduledAt" className="text-sm font-medium">Schedule (optional)</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Working…" : status === "SCHEDULED" ? "Reschedule" : "Send / schedule"}
          </Button>
          {status === "SCHEDULED" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                start(async () => {
                  const res = await cancelAction();
                  if (res && "error" in res && res.error) setError(res.error);
                  else router.refresh();
                })
              }
            >
              Cancel schedule
            </Button>
          ) : null}
        </div>
      </form>

      <form
        action={(fd) =>
          start(async () => {
            const res = await testAction(fd);
            if (res && "error" in res && res.error) {
              setError(res.error);
              setInfo(null);
            } else {
              setError(null);
              setInfo(`Test email queued (mock).`);
            }
          })
        }
        className="space-y-2 rounded-md border p-3"
      >
        <Label htmlFor="testEmail" className="text-sm font-medium">Send test to</Label>
        <Input id="testEmail" name="testEmail" type="email" required placeholder="you@example.com" />
        <input type="hidden" name="campaignId" value={campaignId} />
        <Button type="submit" variant="outline" disabled={pending}>Send test</Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
    </div>
  );
}
