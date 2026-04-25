"use client";

import { useState, useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { switchWorkspaceAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

type Membership = {
  id: string;
  workspace: { id: string; name: string; slug: string };
};

export function WorkspaceSwitcher({
  memberships,
  activeId,
  activeName,
}: {
  memberships: Membership[];
  activeId: string;
  activeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (memberships.length <= 1) {
    return (
      <div className="rounded-md border bg-muted/40 px-3 py-1.5 text-sm font-medium" suppressHydrationWarning>
        {activeName}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
        disabled={pending}
      >
        <span className="max-w-[180px] truncate">{activeName}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Switch workspace
            </div>
            {memberships.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  startTransition(() => {
                    void switchWorkspaceAction(m.workspace.id);
                  });
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                  m.workspace.id === activeId && "font-medium"
                )}
              >
                <span className="truncate">{m.workspace.name}</span>
                {m.workspace.id === activeId && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
