import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  HEATMAP_SITE_STATUSES,
  HEATMAP_SITE_STATUS_LABELS,
} from "@/modules/heatmaps/schemas";
import { createHeatmapSiteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewHeatmapSitePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "heatmapSite", "create");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New heatmap site</h1>
        <p className="text-sm text-muted-foreground">
          Register a domain to track. A unique tracker key is generated automatically.
        </p>
      </div>

      <Card className="p-4">
        <form action={createHeatmapSiteAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={160}
              placeholder="Marketing site"
            />
          </div>
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              name="domain"
              required
              maxLength={160}
              placeholder="example.com"
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="ACTIVE">
              {HEATMAP_SITE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {HEATMAP_SITE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sampleRate">Sample rate %</Label>
            <Input
              id="sampleRate"
              name="sampleRate"
              type="number"
              min={1}
              max={100}
              defaultValue={100}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              1 = capture 1% of sessions, 100 = capture all.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create site</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
