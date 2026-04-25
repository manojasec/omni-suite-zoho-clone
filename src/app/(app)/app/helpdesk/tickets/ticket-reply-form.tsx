"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addTicketMessageAction } from "./actions";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        start(async () => {
          fd.set("isInternal", internal ? "true" : "");
          const res = await addTicketMessageAction(ticketId, fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            formRef.current?.reset();
            router.refresh();
          }
        })
      }
      className={`space-y-2 rounded-md border p-3 ${internal ? "bg-amber-50 border-amber-200" : ""}`}
    >
      <Textarea
        name="body"
        rows={4}
        required
        placeholder={internal ? "Internal note (only visible to your team)…" : "Reply to the customer…"}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
          />
          Internal note
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : internal ? "Add note" : "Reply"}
        </Button>
      </div>
    </form>
  );
}
