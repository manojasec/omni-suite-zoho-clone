import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createPostAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewConnectPostPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "create");
  const sp = await searchParams;

  const groups = await prisma.connectGroup.findMany({
    where: { workspaceId: ctx.workspaceId, archived: false },
    orderBy: { name: "asc" },
  });
  const defaultGroup = sp.group ? groups.find((g) => g.slug === sp.group) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/connect" className="hover:underline">← Feed</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
      </div>
      <Card className="p-4">
        <form action={createPostAction} className="space-y-3">
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" name="title" maxLength={200} />
          </div>
          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" rows={6} required maxLength={20_000} />
          </div>
          <div>
            <Label htmlFor="groupId">Group (optional)</Label>
            <Select id="groupId" name="groupId" defaultValue={defaultGroup?.id ?? ""}>
              <option value="">No group — workspace-wide</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/connect"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Post</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
