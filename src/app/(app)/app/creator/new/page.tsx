import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createCreatorAppAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCreatorAppPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New app</h1>
          <p className="text-sm text-muted-foreground">
            Define the basics — you can add entities and fields after.
          </p>
        </div>
        <Link
          href="/app/creator"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <form action={createCreatorAppAction} className="grid gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              required
              maxLength={80}
              placeholder="inventory-tracker"
              pattern="[a-z][a-z0-9-]*"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, digits, and hyphens.
            </p>
          </div>
          <div>
            <Label htmlFor="icon">Icon (emoji, optional)</Label>
            <Input id="icon" name="icon" maxLength={40} placeholder="📦" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Create app
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
