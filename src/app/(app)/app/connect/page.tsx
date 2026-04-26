import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/modules/connect/schemas";
import { toggleLikePostAction, togglePinPostAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConnectFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "view");
  const sp = await searchParams;
  const groupSlug = sp.group;

  const groupFilter = groupSlug
    ? await prisma.connectGroup.findFirst({
        where: { slug: groupSlug, workspaceId: ctx.workspaceId },
      })
    : null;

  const posts = await prisma.connectPost.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(groupFilter ? { groupId: groupFilter.id } : {}),
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
      group: { select: { slug: true, name: true } },
      _count: { select: { comments: true, likes: true } },
      likes: { where: { userId: ctx.userId }, select: { id: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  const canEdit = can(ctx.role, "connectPost", "edit");
  const canCreate = can(ctx.role, "connectPost", "create");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {groupFilter ? `# ${groupFilter.name}` : "Connect"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {groupFilter ? "Group feed" : "Internal company feed for the whole workspace."}
            </p>
          </div>
          {canCreate ? (
            <Link href={`/app/connect/new${groupFilter ? `?group=${groupFilter.slug}` : ""}`}>
              <Button>New post</Button>
            </Link>
          ) : null}
        </div>

        {posts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No posts yet — be the first to share an update.
          </Card>
        ) : (
          posts.map((p) => (
            <Card key={p.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {p.author?.name ?? p.author?.email ?? "User"}
                  </span>
                  <span> · {timeAgo(p.createdAt)}</span>
                  {p.group ? (
                    <>
                      {" · in "}
                      <Link href={`/app/connect?group=${p.group.slug}`} className="hover:underline">
                        # {p.group.name}
                      </Link>
                    </>
                  ) : null}
                  {p.pinned ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Pinned</span> : null}
                </div>
                {canEdit ? (
                  <form action={togglePinPostAction.bind(null, p.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">
                      {p.pinned ? "Unpin" : "Pin"}
                    </button>
                  </form>
                ) : null}
              </div>
              {p.title ? (
                <h2 className="text-base font-semibold">
                  <Link href={`/app/connect/${p.id}`} className="hover:underline">{p.title}</Link>
                </h2>
              ) : null}
              <p className="whitespace-pre-wrap text-sm">{p.body}</p>
              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                <form action={toggleLikePostAction.bind(null, p.id)}>
                  <button
                    type="submit"
                    className={
                      "hover:text-foreground " +
                      (p.likes.length > 0 ? "text-rose-600 font-medium" : "")
                    }
                  >
                    ♥ {p._count.likes}
                  </button>
                </form>
                <Link href={`/app/connect/${p.id}`} className="hover:text-foreground">
                  💬 {p._count.comments}
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="p-4 self-start">
        <h2 className="text-sm font-semibold mb-2">Groups</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/app/connect"
              className={!groupFilter ? "font-medium" : "text-muted-foreground hover:text-foreground"}
            >
              All posts
            </Link>
          </li>
          {(
            await prisma.connectGroup.findMany({
              where: { workspaceId: ctx.workspaceId, archived: false },
              orderBy: { name: "asc" },
              take: 30,
            })
          ).map((g) => (
            <li key={g.id}>
              <Link
                href={`/app/connect?group=${g.slug}`}
                className={
                  groupFilter?.id === g.id
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                # {g.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t pt-2 text-xs">
          <Link href="/app/connect/groups" className="hover:underline">Manage groups →</Link>
        </div>
      </Card>
    </div>
  );
}
