"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to OmniSuite</CardTitle>
        <CardDescription>Welcome back. Enter your credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            start(async () => {
              const res = await loginAction(fd);
              if (res?.error) setError(res.error);
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            New here? <Link className="underline" href="/signup">Create an account</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
