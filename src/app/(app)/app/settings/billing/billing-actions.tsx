"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props =
  | { mode: "checkout"; plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE"; label: string }
  | { mode: "portal" };

export function BillingActions(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const url = props.mode === "checkout" ? "/api/stripe/checkout" : "/api/stripe/portal";
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: props.mode === "checkout" ? JSON.stringify({ plan: props.plan }) : "{}",
        });
        const json = await res.json();
        if (!res.ok || !json.url) {
          throw new Error(json.error ?? "Request failed");
        }
        window.location.href = json.url as string;
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-1">
      <Button onClick={handleClick} disabled={pending} size="sm" variant={props.mode === "portal" ? "outline" : "default"}>
        {pending ? "Redirecting…" : props.mode === "portal" ? "Manage in Stripe" : props.label}
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
