"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Company = { id: string; name: string };
type Owner = { id: string; name: string | null; email: string };

const STAGES = ["LEAD", "MQL", "SQL", "CUSTOMER", "CHURNED"] as const;

export type ContactValues = {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  lifecycleStage?: string;
  source?: string | null;
  tags?: string[];
  notes?: string | null;
};

export function ContactForm({
  action,
  initial,
  companies,
  owners,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: ContactValues;
  companies: Company[];
  owners: Owner[];
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
          <Field label="First name" name="firstName" defaultValue={initial?.firstName} required />
          <Field label="Last name" name="lastName" defaultValue={initial?.lastName ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={initial?.email ?? ""} />
          <Field label="Phone" name="phone" defaultValue={initial?.phone ?? ""} />
          <Field label="Title" name="title" defaultValue={initial?.title ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="companyId">Company</Label>
            <Select id="companyId" name="companyId" defaultValue={initial?.companyId ?? ""}>
              <option value="">— None —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerId">Owner</Label>
            <Select id="ownerId" name="ownerId" defaultValue={initial?.ownerId ?? ""}>
              <option value="">— Unassigned —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name ?? o.email}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lifecycleStage">Lifecycle stage</Label>
            <Select id="lifecycleStage" name="lifecycleStage" defaultValue={initial?.lifecycleStage ?? "LEAD"}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <Field label="Source" name="source" defaultValue={initial?.source ?? ""} />
          <Field
            label="Tags (comma-separated)"
            name="tags"
            defaultValue={(initial?.tags ?? []).join(", ")}
          />

          <div className="md:col-span-2 flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={4} defaultValue={initial?.notes ?? ""} />
          </div>

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
  label, name, defaultValue, type = "text", required = false,
}: { label: string; name: string; defaultValue?: string | null; type?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}{required ? " *" : ""}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}
