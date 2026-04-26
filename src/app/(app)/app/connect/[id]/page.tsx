import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/modules/connect/schemas";
import {
  createCommentAction,
  deleteCommentAction,
  toggleLikePostAction,
  togglePinPostAction,
  deletePostAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ConnectPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "view");
  const { id } = await params;

  const post = await prisma.connectPost.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      group: { select: { slug: true, name: true } },
      _count: { select: { likes: true } },
      likes: { where: { userId: ctx.userId }, select: { id: true } },
    },
  });
  if (!post) notFound();

  const comments = await prisma.connectComment.findMany({
    where: { postId: id },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const canEdit = can(ctx.role, "connectPost", "edit");
  const canDeletePost = post.authorId === ctx.userId || can(ctx.role, "connectPost", "delete");
  const canDeleteComment = can(ctx.role, "connectComment", "delete");
  const canComment = can(ctx.role, "connectComment", "create");

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/connect" className="hover:underline">← Feed</Link>
        </p>
      </div>
      <Card className="p-4 space-y-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {post.author?.name ?? post.author?.email ?? "User"}
          </span>
          <span> · {timeAgo(post.createdAt)}</span>
          {post.group ? (
            <>
              {" · in "}
              <Link href={`/app/connect?group=${post.group.slug}`} className="hover:underline">
                # {post.group.name}
              </Link>
            </>
          ) : null}
          {post.pinned ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Pinned</span> : null}
        </div>
        {post.title ? <h1 className="text-xl font-semibold">{post.title}</h1> : null}
        <p className="whitespace-pre-wrap text-sm">{post.body}</p>
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
          <form action={toggleLikePostAction.bind(null, post.id)}>
            <button type="submit" className={"hover:text-foreground " + (post.likes.length > 0 ? "text-rose-600 font-medium" : "")}>
              ♥ {post._count.likes}
            </button>
          </form>
          {canEdit ? (
            <form action={togglePinPostAction.bind(null, post.id)}>
              <button type="submit" className="hover:text-foreground">
                {post.pinned ? "Unpin" : "Pin"}
              </button>
            </form>
          ) : null}
          {canDeletePost ? (
            <form action={deletePostAction.bind(null, post.id)}>
              <button type="submit" className="hover:text-red-600">Delete post</button>
            </form>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 text-sm">Comments ({comments.length})</h2>
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {c.author?.name ?? c.author?.email ?? "User"}
                    </span>
                    <span> · {timeAgo(c.createdAt)}</span>
                  </span>
                  {(c.authorId === ctx.userId || canDeleteComment) ? (
                    <form action={deleteCommentAction.bind(null, c.id)}>
                      <button type="submit" className="hover:text-red-600">Delete</button>
                    </form>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap mt-0.5">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        {canComment ? (
          <form action={createCommentAction.bind(null, post.id)} className="mt-4 space-y-2 border-t pt-3">
            <Textarea name="body" rows={2} maxLength={4000} required placeholder="Write a comment..." />
            <div className="flex justify-end">
              <Button type="submit" size="sm">Comment</Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
