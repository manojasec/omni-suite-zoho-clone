import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createNoteAction } from "../actions";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ notebook?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "note", "create");
  const sp = await searchParams;
  const notebooks = await prisma.notebook.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">New note</h1>
      <Card className="p-6">
        <form action={createNoteAction} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} autoFocus />
          </div>
          <div>
            <Label htmlFor="notebookId">Notebook</Label>
            <Select id="notebookId" name="notebookId" defaultValue={sp.notebook ?? ""}>
              <option value="">— None —</option>
              {notebooks.map((nb) => <option key={nb.id} value={nb.id}>{nb.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" name="content" rows={14} maxLength={50000} />
          </div>
          <Button type="submit">Create note</Button>
        </form>
      </Card>
    </div>
  );
}
