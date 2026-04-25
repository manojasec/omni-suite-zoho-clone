"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export type CompanyValues = {
  name?: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
};

export function CompanyForm({
  action,
  initial,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: CompanyValues;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={(fd) =>
            start(async () => {
              const res = await action(fd);
              if (res && "error" in res && res.error) setError(res.error);
              else setError(null);
            })
          }
          className="grid gap-4 md:grid-cols-2"
        >
          <Field label="Name" name="name" defaultValue={initial?.name} required />
          <Field label="Domain" name="domain" defaultValue={initial?.domain ?? ""} placeholder="acme.com" />
          <Field label="Industry" name="industry" defaultValue={initial?.industry ?? ""} />
          <Field label="Size" name="size" defaultValue={initial?.size ?? ""} placeholder="e.g. 50-200" />

          {error ? <p className="md:col-span-2 text-sm text-destructive">{error}</p> : null}

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label, name, defaultValue, required = false, placeholder,
}: { label: string; name: string; defaultValue?: string | null; required?: boolean; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}{required ? " *" : ""}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}
