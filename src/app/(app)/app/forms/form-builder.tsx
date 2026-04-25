"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FIELD_TYPES, type FieldDef, type FieldType } from "@/modules/forms/schemas";
import { Plus, Trash2 } from "lucide-react";

let nextId = 1;
const cid = () => `f${Date.now().toString(36)}${(nextId++).toString(36)}`;

const blankField = (): FieldDef => ({
  id: cid(),
  type: "text",
  label: "Untitled field",
  name: `field_${nextId}`,
  required: false,
  placeholder: "",
  options: [],
});

export function FormBuilder({
  action,
  initial,
  submitLabel = "Save",
}: {
  action: (fd: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  initial?: {
    name?: string;
    destination?: "contact" | "lead" | "ticket" | "submission";
    isPublished?: boolean;
    fields?: FieldDef[];
  };
  submitLabel?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<FieldDef[]>(
    initial?.fields && initial.fields.length > 0 ? initial.fields : [blankField()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (id: string, patch: Partial<FieldDef>) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) =>
    setFields((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));
  const move = (id: string, dir: -1 | 1) =>
    setFields((prev) => {
      const i = prev.findIndex((f) => f.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <form
      action={(fd) =>
        start(async () => {
          // Replace any auto-encoded field arrays from controlled inputs with a clean serialization.
          fd.delete("f_id");
          fd.delete("f_type");
          fd.delete("f_label");
          fd.delete("f_name");
          fd.delete("f_required");
          fd.delete("f_placeholder");
          fd.delete("f_options");
          for (const f of fields) {
            fd.append("f_id", f.id);
            fd.append("f_type", f.type);
            fd.append("f_label", f.label);
            fd.append("f_name", f.name);
            fd.append("f_required", f.required ? "on" : "");
            fd.append("f_placeholder", f.placeholder ?? "");
            fd.append("f_options", (f.options ?? []).join(","));
          }
          const res = await action(fd);
          if (res && "error" in res && res.error) setError(res.error);
          else {
            setError(null);
            router.refresh();
          }
        })
      }
      className="space-y-6"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label htmlFor="name">Form name *</Label>
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="destination">Destination</Label>
          <select
            id="destination"
            name="destination"
            defaultValue={initial?.destination ?? "submission"}
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
          >
            {["submission", "lead", "contact", "ticket"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <label className="md:col-span-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={initial?.isPublished} />
          Published (publicly accessible)
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Fields</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => setFields((p) => [...p, blankField()])}>
            <Plus className="h-4 w-4" /> Add field
          </Button>
        </div>
        <ul className="space-y-3">
          {fields.map((f, i) => (
            <li key={f.id} className="rounded-md border p-3">
              <div className="grid gap-2 md:grid-cols-12">
                <div className="md:col-span-2">
                  <Label>Type</Label>
                  <select
                    value={f.type}
                    onChange={(e) => update(f.id, { type: e.target.value as FieldType, options: [] })}
                    className="mt-1 h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                  >
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <Label>Label</Label>
                  <Input
                    value={f.label}
                    onChange={(e) => update(f.id, { label: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-3">
                  <Label>Field name</Label>
                  <Input
                    value={f.name}
                    onChange={(e) => update(f.id, { name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-3">
                  <Label>Placeholder</Label>
                  <Input
                    value={f.placeholder ?? ""}
                    onChange={(e) => update(f.id, { placeholder: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-1 flex items-end">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => update(f.id, { required: e.target.checked })}
                    />
                    Req
                  </label>
                </div>
                {(f.type === "select" || f.type === "radio") ? (
                  <div className="md:col-span-12">
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={(f.options ?? []).join(", ")}
                      onChange={(e) => update(f.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="mt-1"
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(f.id, -1)}>↑</Button>
                <Button type="button" size="sm" variant="ghost" disabled={i === fields.length - 1} onClick={() => move(f.id, 1)}>↓</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove(f.id)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

export function FormPreview({ fields }: { fields: FieldDef[] }) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/40 p-4">
      <p className="text-xs uppercase text-muted-foreground">Live preview</p>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.id} className="space-y-1">
            <Label>{f.label} {f.required ? "*" : ""}</Label>
            {f.type === "textarea" ? (
              <Textarea placeholder={f.placeholder ?? ""} rows={3} />
            ) : f.type === "select" ? (
              <select className="h-9 w-full rounded-md border bg-transparent px-2 text-sm">
                <option value="">Select…</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "radio" ? (
              <div className="flex flex-col gap-1">
                {(f.options ?? []).map((o) => (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={f.name} /> {o}
                  </label>
                ))}
              </div>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" /> {f.label}
              </label>
            ) : (
              <Input type={f.type === "phone" ? "tel" : f.type} placeholder={f.placeholder ?? ""} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
