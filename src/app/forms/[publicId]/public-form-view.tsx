"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { submitFormAction } from "@/app/(app)/app/forms/actions";
import type { FieldDef } from "@/modules/forms/schemas";

export function PublicFormView({
  publicId,
  name,
  fields,
}: {
  publicId: string;
  name: string;
  fields: FieldDef[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="rounded-lg border bg-emerald-50 p-6 text-emerald-800">
        <p className="font-semibold">Thanks — your submission was received.</p>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await submitFormAction(publicId, fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            setDone(true);
          }
        })
      }
      className="space-y-4"
    >
      <h1 className="text-2xl font-semibold">{name}</h1>

      {/* honeypot — bots fill this */}
      <input
        type="text"
        name="hp_url"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {fields.map((f) => (
        <div key={f.id} className="space-y-1">
          <Label htmlFor={f.id}>{f.label} {f.required ? "*" : ""}</Label>
          {f.type === "textarea" ? (
            <Textarea id={f.id} name={f.name} rows={3} placeholder={f.placeholder ?? ""} required={f.required} />
          ) : f.type === "select" ? (
            <select
              id={f.id}
              name={f.name}
              required={f.required}
              defaultValue=""
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            >
              <option value="" disabled>Select…</option>
              {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === "radio" ? (
            <div className="flex flex-col gap-1">
              {(f.options ?? []).map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={f.name} value={o} required={f.required} /> {o}
                </label>
              ))}
            </div>
          ) : f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" id={f.id} name={f.name} /> {f.label}
            </label>
          ) : (
            <Input
              id={f.id}
              name={f.name}
              type={f.type === "phone" ? "tel" : f.type}
              placeholder={f.placeholder ?? ""}
              required={f.required}
            />
          )}
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
