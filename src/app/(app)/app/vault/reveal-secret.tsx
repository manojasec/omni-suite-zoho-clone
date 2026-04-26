"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revealVaultSecretAction } from "./actions";

export function RevealSecret({ itemId }: { itemId: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reveal() {
    setError(null);
    start(async () => {
      try {
        const r = await revealVaultSecretAction(itemId);
        setSecret(r.secret);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function copy() {
    if (secret) {
      navigator.clipboard.writeText(secret).catch(() => {});
    }
  }

  return (
    <div className="space-y-2">
      {secret == null ? (
        <Button type="button" variant="outline" onClick={reveal} disabled={pending}>
          {pending ? "Decrypting..." : "Reveal secret"}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded border bg-muted px-3 py-1.5 text-sm font-mono break-all">{secret}</code>
          <Button type="button" size="sm" variant="outline" onClick={copy}>Copy</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSecret(null)}>Hide</Button>
        </div>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
