"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { setDealStatusAction } from "./actions";

type Status = "OPEN" | "WON" | "LOST";

export function DealStatusPanel({
  dealId,
  status,
  lostReason,
}: {
  dealId: string;
  status: Status;
  lostReason: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);

  const setStatus = (target: Status, reason?: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set("status", target);
      if (reason) fd.set("lostReason", reason);
      const res = await setDealStatusAction(dealId, fd);
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setError(null);
        setShowLost(false);
      }
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-semibold">{status}</p>
            {status === "LOST" && lostReason ? (
              <p className="text-xs text-muted-foreground mt-1">Reason: {lostReason}</p>
            ) : null}
          </div>
        </div>
        {status === "OPEN" ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setStatus("WON")} disabled={pending}>
              Mark won
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowLost((s) => !s)} disabled={pending}>
              Mark lost
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setStatus("OPEN")} disabled={pending}>
            Reopen
          </Button>
        )}
        {showLost ? (
          <form
            action={(fd) => {
              const reason = (fd.get("lostReason") as string) || "";
              setStatus("LOST", reason);
            }}
            className="flex flex-col gap-2"
          >
            <Label htmlFor="lostReason">Lost reason</Label>
            <Input id="lostReason" name="lostReason" placeholder="Why was this lost?" />
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={pending}>Confirm lost</Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setShowLost(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
