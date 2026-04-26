import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  WRITER_DOC_VISIBILITIES,
  WRITER_DOC_VISIBILITY_LABELS,
} from "@/modules/writer/schemas";
import { createWriterDocAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewWriterDocPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "create");

  const folders = await prisma.writerFolder.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New doc</h1>
          <p className="text-sm text-muted-foreground">
            Drafts are private until published.
          </p>
        </div>
        <Link
          href="/app/writer"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <form action={createWriterDocAction} className="grid gap-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="folderId">Folder</Label>
              <Select id="folderId" name="folderId">
                <option value="">— Root —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="visibility">Visibility</Label>
              <Select id="visibility" name="visibility" defaultValue="WORKSPACE">
                {WRITER_DOC_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {WRITER_DOC_VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              name="content"
              rows={12}
              maxLength={200_000}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm">
              Create draft
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
