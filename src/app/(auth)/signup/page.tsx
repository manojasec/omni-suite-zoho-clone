"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signupAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your workspace</CardTitle>
        <CardDescription>Free trial. No card required.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            start(async () => {
              const res = await signupAction(fd);
              if (res?.error) setError(res.error);
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" name="name" required maxLength={100} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input id="workspaceName" name="workspaceName" required maxLength={80} placeholder="Acme Inc." />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
            <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link className="underline" href="/login">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
