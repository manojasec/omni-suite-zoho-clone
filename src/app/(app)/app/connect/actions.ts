"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  groupSchema,
  postSchema,
  commentSchema,
  slugifyGroup,
} from "@/modules/connect/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

// ---------- Groups ----------

export async function createGroupAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectGroup", "create");
  const parsed = groupSchema.safeParse({
    slug: slugifyGroup(s(fd, "slug") || s(fd, "name")),
    name: s(fd, "name"),
    description: s(fd, "description"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let group;
  try {
    group = await prisma.connectGroup.create({
      data: {
        workspaceId: ctx.workspaceId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Group slug already in use");
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "connectGroup",
    resourceId: group.id,
    diff: { after: { slug: group.slug, name: group.name } },
  });
  revalidatePath("/app/connect/groups");
  redirect(`/app/connect/groups/${group.slug}`);
}

export async function archiveGroupAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectGroup", "edit");
  const g = await prisma.connectGroup.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!g) throw new Error("Group not found");
  await prisma.connectGroup.update({ where: { id }, data: { archived: !g.archived } });
  revalidatePath("/app/connect/groups");
}

// ---------- Posts ----------

async function loadPost(id: string, workspaceId: string) {
  const post = await prisma.connectPost.findFirst({ where: { id, workspaceId } });
  if (!post) throw new Error("Post not found");
  return post;
}

export async function createPostAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "create");
  const parsed = postSchema.safeParse({
    title: s(fd, "title"),
    body: s(fd, "body"),
    groupId: s(fd, "groupId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  // Verify group belongs to workspace if provided.
  if (parsed.data.groupId) {
    const g = await prisma.connectGroup.findFirst({
      where: { id: parsed.data.groupId, workspaceId: ctx.workspaceId, archived: false },
    });
    if (!g) throw new Error("Group not available");
  }

  const post = await prisma.connectPost.create({
    data: {
      workspaceId: ctx.workspaceId,
      authorId: ctx.userId,
      title: parsed.data.title ?? null,
      body: parsed.data.body,
      groupId: parsed.data.groupId ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "connectPost",
    resourceId: post.id,
  });
  revalidatePath("/app/connect");
  redirect(`/app/connect/${post.id}`);
}

export async function togglePinPostAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "edit");
  const post = await loadPost(id, ctx.workspaceId);
  await prisma.connectPost.update({ where: { id }, data: { pinned: !post.pinned } });
  revalidatePath("/app/connect");
  revalidatePath(`/app/connect/${id}`);
}

export async function deletePostAction(id: string) {
  const ctx = await requireSession();
  const post = await loadPost(id, ctx.workspaceId);
  // Authors can always delete their own; otherwise need permission.
  if (post.authorId !== ctx.userId) {
    assertCan(ctx.role, "connectPost", "delete");
  }
  await prisma.connectPost.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "connectPost",
    resourceId: id,
  });
  revalidatePath("/app/connect");
  redirect("/app/connect");
}

export async function toggleLikePostAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectPost", "view");
  await loadPost(id, ctx.workspaceId);
  const existing = await prisma.connectLike.findUnique({
    where: { postId_userId: { postId: id, userId: ctx.userId } },
  });
  if (existing) {
    await prisma.connectLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.connectLike.create({ data: { postId: id, userId: ctx.userId } });
  }
  revalidatePath("/app/connect");
  revalidatePath(`/app/connect/${id}`);
}

// ---------- Comments ----------

export async function createCommentAction(postId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "connectComment", "create");
  await loadPost(postId, ctx.workspaceId);
  const parsed = commentSchema.safeParse({ body: s(fd, "body") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const comment = await prisma.connectComment.create({
    data: { postId, authorId: ctx.userId, body: parsed.data.body },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "connectComment",
    resourceId: comment.id,
  });
  revalidatePath(`/app/connect/${postId}`);
}

export async function deleteCommentAction(commentId: string) {
  const ctx = await requireSession();
  const comment = await prisma.connectComment.findFirst({
    where: { id: commentId, post: { workspaceId: ctx.workspaceId } },
  });
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== ctx.userId) {
    assertCan(ctx.role, "connectComment", "delete");
  }
  await prisma.connectComment.delete({ where: { id: commentId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "connectComment",
    resourceId: commentId,
  });
  revalidatePath(`/app/connect/${comment.postId}`);
}

/** Helper to test whether the current user can moderate (used by UI). */
export async function canModeratePosts(): Promise<boolean> {
  const ctx = await requireSession();
  return can(ctx.role, "connectPost", "delete");
}
