import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { MAX_COLS, MAX_ROWS } from "@/modules/sheet/schemas";
import { createSheetAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSheetPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New sheet</h1>
          <p className="text-sm text-muted-foreground">
            Pick a grid size. You can edit cells after creation.
          </p>
        </div>
        <Link
          href="/app/sheet"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <form action={createSheetAction} className="grid gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
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
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="rowCount">Rows</Label>
              <Input
                id="rowCount"
                name="rowCount"
                type="number"
                defaultValue={20}
                min={1}
                max={MAX_ROWS}
              />
            </div>
            <div>
              <Label htmlFor="colCount">Columns</Label>
              <Input
                id="colCount"
                name="colCount"
                type="number"
                defaultValue={8}
                min={1}
                max={MAX_COLS}
              />
            </div>
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
