import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSiteAction } from "../actions";

export default async function NewSitePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "create");

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New site</h1>
      <Card className="p-4">
        <form action={createSiteAction} className="space-y-3">
          <div>
            <Label htmlFor="name">Site name</Label>
            <Input id="name" name="name" required maxLength={120} placeholder="Marketing landing" />
          </div>
          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              name="slug"
              maxLength={80}
              placeholder="marketing"
              pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Will be available at /site/&lt;slug&gt;. Leave blank to auto-generate from name.
            </p>
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={3} maxLength={500} />
          </div>
          <div>
            <Label htmlFor="themeColor">Theme color</Label>
            <Input id="themeColor" name="themeColor" type="color" defaultValue="#0f172a" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit">Create site</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
