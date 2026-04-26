"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SOURCE_CATALOG, PIVOT_METRICS, PIVOT_SOURCES } from "@/modules/pivots/schemas";

type Defaults = {
  name?: string;
  description?: string | null;
  source?: (typeof PIVOT_SOURCES)[number];
  rowField?: string | null;
  colField?: string | null;
  valueMetric?: (typeof PIVOT_METRICS)[number];
  valueField?: string | null;
  rangeDays?: number;
};

export function PivotForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (fd: FormData) => void;
  defaults?: Defaults;
  submitLabel: string;
}) {
  const [source, setSource] = useState<(typeof PIVOT_SOURCES)[number]>(defaults?.source ?? "DEAL");
  const [metric, setMetric] = useState<(typeof PIVOT_METRICS)[number]>(defaults?.valueMetric ?? "COUNT");
  const cat = SOURCE_CATALOG[source];

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaults?.name ?? ""} required maxLength={160} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={defaults?.description ?? ""} rows={2} maxLength={500} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="source">Source</Label>
          <Select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            {PIVOT_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_CATALOG[s].label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rangeDays">Range (days)</Label>
          <Input id="rangeDays" name="rangeDays" type="number" min={1} max={3650} defaultValue={defaults?.rangeDays ?? 30} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="rowField">Row field</Label>
          <Select id="rowField" name="rowField" defaultValue={defaults?.rowField ?? cat.groupBy[0] ?? ""}>
            {cat.groupBy.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="colField">Column field (optional)</Label>
          <Select id="colField" name="colField" defaultValue={defaults?.colField ?? ""}>
            <option value="">— None —</option>
            {cat.groupBy.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="valueMetric">Value metric</Label>
          <Select id="valueMetric" name="valueMetric" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
            {PIVOT_METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="valueField">Value field {metric === "COUNT" ? "(unused)" : "(required)"}</Label>
          <Select id="valueField" name="valueField" defaultValue={defaults?.valueField ?? ""} disabled={metric === "COUNT"}>
            <option value="">— None —</option>
            {cat.metricFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
