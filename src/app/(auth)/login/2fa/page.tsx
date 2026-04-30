"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verify2faLoginAction } from "../../actions";

export default function TwoFactorChallengePage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app, or one of your
          recovery codes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) =>
            start(async () => {
              setError(null);
              const res = await verify2faLoginAction(fd);
              if (res?.error) setError(res.error);
            })
          }
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={20}
              required
              autoFocus
              placeholder="123456"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Verify"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link className="underline" href="/login">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
