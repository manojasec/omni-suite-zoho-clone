"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteApiKeyAction } from "./actions";

export function DeleteKeyButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Revoke this API key? Applications using it will stop working.")) return;
        startTransition(async () => {
          await deleteApiKeyAction(id);
        });
      }}
    >
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
