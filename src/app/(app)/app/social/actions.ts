"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  socialAccountSchema,
  socialPostSchema,
  nextStatusForPost,
  type SocialPlatform,
} from "@/modules/social/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

function all(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v)).filter(Boolean);
}

// ---------- Accounts ----------

export async function connectSocialAccountAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialAccount", "create");
  const parsed = socialAccountSchema.safeParse({
    platform: s(fd, "platform"),
    handle: s(fd, "handle"),
    displayName: s(fd, "displayName"),
    avatarUrl: s(fd, "avatarUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let account;
  try {
    account = await prisma.socialAccount.create({
      data: {
        workspaceId: ctx.workspaceId,
        connectedById: ctx.userId,
        platform: parsed.data.platform,
        handle: parsed.data.handle,
        displayName: parsed.data.displayName ?? null,
        avatarUrl: parsed.data.avatarUrl ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("This account is already connected");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "connect",
    resource: "socialAccount",
    resourceId: account.id,
    diff: { after: { platform: account.platform, handle: account.handle } },
  });
  revalidatePath("/app/social/accounts");
  redirect("/app/social/accounts");
}

export async function toggleSocialAccountAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialAccount", "edit");
  const acct = await prisma.socialAccount.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!acct) throw new Error("Account not found");
  await prisma.socialAccount.update({ where: { id }, data: { active: !acct.active } });
  revalidatePath("/app/social/accounts");
}

export async function disconnectSocialAccountAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialAccount", "delete");
  const acct = await prisma.socialAccount.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!acct) throw new Error("Account not found");
  await prisma.socialAccount.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "disconnect",
    resource: "socialAccount",
    resourceId: id,
    diff: { before: { platform: acct.platform, handle: acct.handle } },
  });
  revalidatePath("/app/social/accounts");
}

// ---------- Posts ----------

async function loadPost(id: string, workspaceId: string) {
  const post = await prisma.socialPost.findFirst({
    where: { id, workspaceId },
    include: { targets: { include: { account: true } } },
  });
  if (!post) throw new Error("Post not found");
  return post;
}

export async function createSocialPostAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "create");

  const accountIds = all(fd, "accountIds");
  const publishNow = s(fd, "publishNow") === "on";
  const parsed = socialPostSchema.safeParse({
    body: s(fd, "body"),
    mediaUrl: s(fd, "mediaUrl"),
    scheduledAt: s(fd, "scheduledAt"),
    accountIds,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  // Validate every targeted account belongs to this workspace and is active.
  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: parsed.data.accountIds }, workspaceId: ctx.workspaceId, active: true },
  });
  if (accounts.length !== parsed.data.accountIds.length) {
    throw new Error("One or more selected accounts are unavailable");
  }

  const status = nextStatusForPost({
    scheduledAt: parsed.data.scheduledAt ?? null,
    publishNow,
  });

  const post = await prisma.socialPost.create({
    data: {
      workspaceId: ctx.workspaceId,
      authorId: ctx.userId,
      body: parsed.data.body,
      mediaUrl: parsed.data.mediaUrl ?? null,
      scheduledAt: parsed.data.scheduledAt ?? null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      status,
      targets: {
        create: accounts.map((a) => ({
          accountId: a.id,
          status: status === "PUBLISHED" ? "PUBLISHED" : status,
          externalId:
            status === "PUBLISHED"
              ? `mock-${a.platform.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`
              : null,
        })),
      },
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: status === "PUBLISHED" ? "publish" : "create",
    resource: "socialPost",
    resourceId: post.id,
    diff: { after: { status, accountIds: parsed.data.accountIds } },
  });

  revalidatePath("/app/social");
  redirect(`/app/social/${post.id}`);
}

export async function publishSocialPostAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "edit");
  const post = await loadPost(id, ctx.workspaceId);
  if (post.status === "PUBLISHED") return;

  await prisma.$transaction(async (tx) => {
    await tx.socialPost.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date(), failureReason: null },
    });
    for (const t of post.targets) {
      await tx.socialPostTarget.update({
        where: { id: t.id },
        data: {
          status: "PUBLISHED",
          externalId: `mock-${t.account.platform.toLowerCase()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`,
          error: null,
        },
      });
    }
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "publish",
    resource: "socialPost",
    resourceId: id,
  });
  revalidatePath("/app/social");
  revalidatePath(`/app/social/${id}`);
}

export async function cancelSocialPostAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "edit");
  const post = await loadPost(id, ctx.workspaceId);
  if (post.status === "PUBLISHED") throw new Error("Already published");
  await prisma.socialPost.update({ where: { id }, data: { status: "CANCELLED" } });
  await prisma.socialPostTarget.updateMany({
    where: { postId: id, status: { in: ["SCHEDULED", "DRAFT"] } },
    data: { status: "CANCELLED" },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "cancel",
    resource: "socialPost",
    resourceId: id,
  });
  revalidatePath("/app/social");
  revalidatePath(`/app/social/${id}`);
}

export async function deleteSocialPostAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "delete");
  const post = await loadPost(id, ctx.workspaceId);
  await prisma.socialPost.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "socialPost",
    resourceId: id,
    diff: { before: { status: post.status, body: post.body.slice(0, 100) } },
  });
  revalidatePath("/app/social");
  redirect("/app/social");
}

/** Internal: drains scheduled posts whose time has come. Exported for cron/admin use. */
export async function publishDueScheduledPostsAction(): Promise<{ published: number }> {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "edit");
  const now = new Date();
  const due = await prisma.socialPost.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    include: { targets: { include: { account: true } } },
    take: 100,
  });

  let count = 0;
  for (const p of due) {
    await prisma.$transaction(async (tx) => {
      await tx.socialPost.update({
        where: { id: p.id },
        data: { status: "PUBLISHED", publishedAt: now },
      });
      for (const t of p.targets) {
        await tx.socialPostTarget.update({
          where: { id: t.id },
          data: {
            status: "PUBLISHED",
            externalId: `mock-${(t.account.platform as SocialPlatform).toLowerCase()}-${Math.random()
              .toString(36)
              .slice(2, 10)}`,
          },
        });
      }
    });
    count++;
  }

  if (count > 0) {
    revalidatePath("/app/social");
  }
  return { published: count };
}
