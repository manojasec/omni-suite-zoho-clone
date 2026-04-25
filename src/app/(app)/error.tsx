"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We hit an unexpected error rendering this page. The team has been notified.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/app")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
