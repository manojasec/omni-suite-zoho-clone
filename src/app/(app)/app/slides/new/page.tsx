import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createPresentationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPresentationPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "presentation", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New deck</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll create a title slide for you to start with.
          </p>
        </div>
        <Link
          href="/app/slides"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <form action={createPresentationAction} className="grid gap-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Create
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
