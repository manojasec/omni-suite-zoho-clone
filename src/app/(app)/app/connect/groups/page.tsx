import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { archiveGroupAction, createGroupAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ConnectGroupsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectGroup", "view");
  const groups = await prisma.connectGroup.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: { _count: { select: { posts: true } } },
  });

  const canCreate = can(ctx.role, "connectGroup", "create");
  const canEdit = can(ctx.role, "connectGroup", "edit");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connect groups</h1>
          <p className="text-sm text-muted-foreground">Topical channels within the company feed.</p>
        </div>
        {groups.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No groups yet.</Card>
        ) : (
          <Card className="divide-y">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <Link href={`/app/connect/groups/${g.slug}`} className="font-medium hover:underline">
                    # {g.name}
                  </Link>
                  {g.archived ? (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700">archived</span>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {g._count.posts} post{g._count.posts === 1 ? "" : "s"}
                    {g.description ? ` · ${g.description}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <form action={archiveGroupAction.bind(null, g.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      {g.archived ? "Unarchive" : "Archive"}
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
          </Card>
        )}
      </div>

      {canCreate ? (
        <Card className="p-4 self-start">
          <h2 className="text-sm font-semibold mb-2">New group</h2>
          <form action={createGroupAction} className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input id="slug" name="slug" maxLength={80} placeholder="auto-generated from name" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} maxLength={500} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create group</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
