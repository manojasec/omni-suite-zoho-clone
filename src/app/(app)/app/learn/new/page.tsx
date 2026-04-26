import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createCourseAction } from "../actions";

export default async function NewCoursePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "create");

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New course</h1>
        <p className="text-sm text-muted-foreground">
          Title is required. The slug auto-generates from the title — override it if you want a
          shorter URL.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <form action={createCourseAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={160} placeholder="Sales onboarding" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug">Slug (optional)</Label>
            <Input
              id="slug"
              name="slug"
              maxLength={80}
              placeholder="sales-onboarding"
              pattern="^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$"
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, digits, dashes.</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="summary">Summary</Label>
            <Input id="summary" name="summary" maxLength={500} placeholder="Short tagline" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              placeholder="What learners will know by the end…"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="coverImageUrl">Cover image URL</Label>
            <Input
              id="coverImageUrl"
              name="coverImageUrl"
              type="url"
              maxLength={500}
              placeholder="https://…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit">Create course</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
