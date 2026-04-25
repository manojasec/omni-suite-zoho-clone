"use client";

import { useState, useTransition } from "react";
import { inviteUserAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "AGENT", "SALES", "FINANCE", "VIEWER"] as const;

export function InviteForm() {
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await inviteUserAction(fd);
          setMsg(res ?? null);
        })
      }
      className="grid gap-4 md:grid-cols-[1fr_200px_auto]"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="teammate@company.com" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="MEMBER">
          {ROLES.filter(r => r !== "OWNER").map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send invite"}</Button>
      </div>
      {msg?.error ? <p className="md:col-span-3 text-sm text-destructive">{msg.error}</p> : null}
      {msg?.message ? <p className="md:col-span-3 text-sm text-green-700">{msg.message}</p> : null}
    </form>
  );
}
