"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiKeyAction } from "./actions";

const SCOPES = ["read", "write", "admin"] as const;

export function ApiKeyCreator() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setCreatedKey(null);
    startTransition(async () => {
      const result = await createApiKeyAction(formData);
      if (result?.error) setError(result.error);
      else if (result?.key) setCreatedKey(result.key);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium">Name</label>
        <Input name="name" placeholder="Production server" required maxLength={80} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Scopes</label>
        <div className="flex flex-wrap gap-3 text-sm">
          {SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="scopes"
                value={s}
                defaultChecked={s === "read"}
                className="h-4 w-4 rounded border"
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Creating…" : "Create key"}
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {createdKey ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p className="font-medium">Copy your key now — it will not be shown again.</p>
          <code className="block break-all rounded bg-background p-2 font-mono text-xs">{createdKey}</code>
        </div>
      ) : null}
    </form>
  );
}
