"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Company = { id: string; name: string };

export type CustomerValues = {
  name?: string;
  email?: string | null;
  companyId?: string | null;
  billingAddress?: string | null;
  taxId?: string | null;
  currency?: string;
};

export function CustomerForm({
  action,
  initial,
  companies,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: CustomerValues;
  companies: Company[];
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
          <Field label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} />
          <Field label="Currency" name="currency" defaultValue={initial?.currency ?? "USD"} />
          <Field label="Tax ID" name="taxId" defaultValue={initial?.taxId ?? ""} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="companyId">Company</Label>
            <select
              id="companyId"
              name="companyId"
              defaultValue={initial?.companyId ?? ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            <Label htmlFor="billingAddress">Billing address</Label>
            <Textarea id="billingAddress" name="billingAddress" rows={3} defaultValue={initial?.billingAddress ?? ""} />
          </div>

          {error ? <p className="md:col-span-2 text-sm text-destructive">{error}</p> : null}

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label, name, defaultValue, required = false, type = "text",
}: { label: string; name: string; defaultValue?: string | null; required?: boolean; type?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}{required ? " *" : ""}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}
