import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createExperimentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExperimentPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "create");

  const initialVariants = [
    { key: "control", label: "Control", weight: 50, control: true },
    { key: "variant_a", label: "Variant A", weight: 50, control: false },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/experiments" className="hover:underline">← Experiments</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New experiment</h1>
      </div>
      <Card className="p-4">
        <form action={createExperimentAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input id="slug" name="slug" maxLength={80} placeholder="auto-generated from name" />
            </div>
          </div>
          <div>
            <Label htmlFor="primaryMetric">Primary metric</Label>
            <Input
              id="primaryMetric"
              name="primaryMetric"
              maxLength={120}
              placeholder="e.g. Signup conversion"
            />
          </div>
          <div>
            <Label htmlFor="hypothesis">Hypothesis</Label>
            <Textarea id="hypothesis" name="hypothesis" rows={3} maxLength={1000} />
          </div>

          <div className="space-y-2 border-t pt-3">
            <h2 className="text-sm font-semibold">Variants</h2>
            <p className="text-xs text-muted-foreground">
              Weights must sum to 100. Mark exactly one variant as control.
            </p>
            <div className="space-y-2">
              {initialVariants.map((v) => (
                <div key={v.key} className="grid gap-2 sm:grid-cols-[140px_1fr_100px_80px] items-end">
                  <div>
                    <Label htmlFor={`key-${v.key}`}>Key</Label>
                    <Input
                      id={`key-${v.key}`}
                      name="variant.key"
                      defaultValue={v.key}
                      required
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`label-${v.key}`}>Label</Label>
                    <Input
                      id={`label-${v.key}`}
                      name="variant.label"
                      defaultValue={v.label}
                      required
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`weight-${v.key}`}>Weight</Label>
                    <Input
                      id={`weight-${v.key}`}
                      name="variant.weight"
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={v.weight}
                      required
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs pb-2">
                    <input
                      type="radio"
                      name="controlKey"
                      value={v.key}
                      defaultChecked={v.control}
                    />
                    Control
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: more variants can be added by editing the experiment after creation in a future
              version. For now, MVP supports two-variant tests defined at creation time.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Link href="/app/experiments">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Create experiment</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
