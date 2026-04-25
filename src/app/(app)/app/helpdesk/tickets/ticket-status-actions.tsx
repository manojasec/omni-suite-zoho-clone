"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { setTicketStatusAction } from "./actions";

const NEXT: Record<string, { label: string; status: string }[]> = {
  OPEN:     [{ label: "Pending", status: "PENDING" }, { label: "Resolve", status: "RESOLVED" }],
  PENDING:  [{ label: "Re-open", status: "OPEN" }, { label: "Resolve", status: "RESOLVED" }],
  ON_HOLD:  [{ label: "Re-open", status: "OPEN" }],
  RESOLVED: [{ label: "Close", status: "CLOSED" }, { label: "Re-open", status: "OPEN" }],
  CLOSED:   [{ label: "Re-open", status: "OPEN" }],
};

export function TicketStatusActions({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setStatus = (target: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set("status", target);
      const res = await setTicketStatusAction(ticketId, fd);
      if (res && "error" in res && res.error) setError(res.error);
      else setError(null);
    });

  const options = NEXT[status] ?? [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o.status} size="sm" variant="outline" onClick={() => setStatus(o.status)} disabled={pending}>
            {o.label}
          </Button>
        ))}
        {status !== "ON_HOLD" ? (
          <Button size="sm" variant="ghost" onClick={() => setStatus("ON_HOLD")} disabled={pending}>
            On hold
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
