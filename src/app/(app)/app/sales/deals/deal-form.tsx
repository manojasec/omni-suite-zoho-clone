"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Option = { id: string; name: string };
type Stage = { id: string; name: string; pipelineId: string };

export type DealValues = {
  name?: string;
  value?: string;
  currency?: string;
  pipelineId?: string;
  stageId?: string;
  contactId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  expectedCloseAt?: string | null;
};

export function DealForm({
  action,
  initial,
  pipelines,
  stages,
  contacts,
  companies,
  owners,
  submitLabel,
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: DealValues;
  pipelines: Option[];
  stages: Stage[];
  contacts: Option[];
  companies: Option[];
  owners: Array<{ id: string; name: string | null; email: string }>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pipelineId, setPipelineId] = useState(initial?.pipelineId ?? pipelines[0]?.id ?? "");
  const stagesForPipeline = useMemo(
    () => stages.filter((s) => s.pipelineId === pipelineId),
    [stages, pipelineId],
  );
  const [stageId, setStageId] = useState(initial?.stageId ?? stagesForPipeline[0]?.id ?? "");

  const onPipelineChange = (id: string) => {
    setPipelineId(id);
    const first = stages.find((s) => s.pipelineId === id);
    setStageId(first?.id ?? "");
  };

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
          <Field label="Deal name" name="name" defaultValue={initial?.name} required />
          <Field label="Value" name="value" defaultValue={initial?.value ?? "0"} type="number" step="0.01" />
          <Field label="Currency" name="currency" defaultValue={initial?.currency ?? "USD"} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="pipelineId">Pipeline *</Label>
            <select
              id="pipelineId"
              name="pipelineId"
              value={pipelineId}
              onChange={(e) => onPipelineChange(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              required
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="stageId">Stage *</Label>
            <select
              id="stageId"
              name="stageId"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              required
            >
              {stagesForPipeline.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <SelectField label="Contact" name="contactId" defaultValue={initial?.contactId ?? ""} options={contacts} />
          <SelectField label="Company" name="companyId" defaultValue={initial?.companyId ?? ""} options={companies} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="ownerId">Owner</Label>
            <select
              id="ownerId"
              name="ownerId"
              defaultValue={initial?.ownerId ?? ""}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— Unassigned —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name ?? o.email}</option>
              ))}
            </select>
          </div>

          <Field
            label="Expected close"
            name="expectedCloseAt"
            type="date"
            defaultValue={
              initial?.expectedCloseAt
                ? new Date(initial.expectedCloseAt).toISOString().slice(0, 10)
                : ""
            }
          />

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
  label, name, defaultValue, required = false, type = "text", step, placeholder,
}: {
  label: string; name: string; defaultValue?: string | null; required?: boolean;
  type?: string; step?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}{required ? " *" : ""}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label, name, defaultValue, options,
}: { label: string; name: string; defaultValue?: string; options: Option[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">— None —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}
