import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { PRIORITIES } from "@/modules/itsm/schemas";
import { createProblemAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "create");

  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, name: true },
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New problem</h1>
        <p className="text-sm text-muted-foreground">
          Investigate a root cause and capture a workaround.
        </p>
      </div>

      <Card className="p-4">
        <form action={createProblemAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue="MEDIUM">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="assetId">Asset (optional)</Label>
            <Select id="assetId" name="assetId" defaultValue="">
              <option value="">— None —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  [{a.tag}] {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="workaround">Workaround</Label>
            <Textarea id="workaround" name="workaround" rows={2} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rootCause">Root cause</Label>
            <Textarea id="rootCause" name="rootCause" rows={2} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create problem</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
