import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_POST_STATUS_LABELS,
  PLATFORM_LIMITS,
  platformsExceeded,
  type SocialPlatform,
  type SocialPostStatus,
} from "@/modules/social/schemas";
import {
  publishSocialPostAction,
  cancelSocialPostAction,
  deleteSocialPostAction,
} from "../actions";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined) {
  return d ? d.toISOString().replace("T", " ").slice(0, 16) : "—";
}

export default async function SocialPostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "view");
  const { id } = await params;

  const post = await prisma.socialPost.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      author: { select: { name: true, email: true } },
      targets: { include: { account: true } },
    },
  });
  if (!post) notFound();

  const platforms = post.targets.map((t) => t.account.platform as SocialPlatform);
  const overLimit = platformsExceeded(post.body, platforms);
  const canEdit = can(ctx.role, "socialPost", "edit");
  const canDelete = can(ctx.role, "socialPost", "delete");

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/social" className="hover:underline">← All posts</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Post</h1>
        <p className="text-sm text-muted-foreground">
          {SOCIAL_POST_STATUS_LABELS[post.status as SocialPostStatus]} · by {post.author?.name ?? post.author?.email ?? "—"}
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <p className="whitespace-pre-wrap text-sm">{post.body}</p>
        {post.mediaUrl ? (
          <p className="text-xs text-muted-foreground break-all">
            Media: <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="hover:underline">{post.mediaUrl}</a>
          </p>
        ) : null}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Body length: {post.body.length} chars</p>
          {overLimit.length > 0 ? (
            <p className="text-red-600">
              Exceeds limit on: {overLimit.map((p) => `${SOCIAL_PLATFORM_LABELS[p]} (${PLATFORM_LIMITS[p]})`).join(", ")}
            </p>
          ) : null}
          <p>Scheduled: {fmtDate(post.scheduledAt)} · Published: {fmtDate(post.publishedAt)}</p>
        </div>
        {post.failureReason ? (
          <p className="text-xs text-red-600">Failure: {post.failureReason}</p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2 text-sm">Targets</h2>
        <ul className="divide-y">
          {post.targets.map((t) => (
            <li key={t.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                {SOCIAL_PLATFORM_LABELS[t.account.platform as SocialPlatform]} · @{t.account.handle}
              </span>
              <span className="text-xs text-muted-foreground">
                {SOCIAL_POST_STATUS_LABELS[t.status as SocialPostStatus]}
                {t.externalId ? ` · ${t.externalId}` : ""}
                {t.error ? ` · ${t.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canEdit && post.status !== "PUBLISHED" && post.status !== "CANCELLED" ? (
          <form action={publishSocialPostAction.bind(null, post.id)}>
            <Button type="submit" size="sm">Publish now</Button>
          </form>
        ) : null}
        {canEdit && (post.status === "DRAFT" || post.status === "SCHEDULED") ? (
          <form action={cancelSocialPostAction.bind(null, post.id)}>
            <Button type="submit" size="sm" variant="outline">Cancel</Button>
          </form>
        ) : null}
        {canDelete ? (
          <form action={deleteSocialPostAction.bind(null, post.id)}>
            <Button type="submit" size="sm" variant="outline" className="text-red-600">Delete</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
