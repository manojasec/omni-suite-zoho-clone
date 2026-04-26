"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  canTransitionArticle,
  isCategoryDescendant,
  kbArticleSchema,
  kbCategorySchema,
  slugify,
  type KbArticleStatus,
} from "@/modules/help/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadCategory(id: string, workspaceId: string) {
  return prisma.kbCategory.findFirst({ where: { id, workspaceId } });
}

async function loadArticle(id: string, workspaceId: string) {
  return prisma.kbArticle.findFirst({ where: { id, workspaceId } });
}

async function ensureUniqueCategorySlug(
  workspaceId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug || slugify("category");
  let candidate = base;
  let i = 2;
  while (
    await prisma.kbCategory.findFirst({
      where: {
        workspaceId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${i++}`;
    if (i > 1000) throw new Error("Could not allocate slug");
  }
  return candidate;
}

async function ensureUniqueArticleSlug(
  workspaceId: string,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug || slugify("article");
  let candidate = base;
  let i = 2;
  while (
    await prisma.kbArticle.findFirst({
      where: {
        workspaceId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${i++}`;
    if (i > 1000) throw new Error("Could not allocate slug");
  }
  return candidate;
}

export async function createKbCategoryAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "create");
  const data = kbCategorySchema.parse(toFormObject(fd));

  if (data.parentId) {
    const parent = await loadCategory(data.parentId, ctx.workspaceId);
    if (!parent) throw new Error("Parent category not found");
  }

  const slug = await ensureUniqueCategorySlug(ctx.workspaceId, data.slug);
  const c = await prisma.kbCategory.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      slug,
      description: data.description || null,
      parentId: data.parentId ?? null,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "kbCategory",
    resourceId: c.id,
    diff: { name: c.name, slug: c.slug },
  });

  revalidatePath("/app/help");
}

export async function updateKbCategoryAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "edit");
  const cat = await loadCategory(id, ctx.workspaceId);
  if (!cat) throw new Error("Category not found");
  const data = kbCategorySchema.parse(toFormObject(fd));

  if (data.parentId) {
    const all = await prisma.kbCategory.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true, parentId: true },
    });
    if (isCategoryDescendant(all, id, data.parentId)) {
      throw new Error("Cannot move a category under its own descendant");
    }
  }

  const slug =
    data.slug && data.slug !== cat.slug
      ? await ensureUniqueCategorySlug(ctx.workspaceId, data.slug, id)
      : cat.slug;

  await prisma.kbCategory.update({
    where: { id },
    data: {
      name: data.name,
      slug,
      description: data.description || null,
      parentId: data.parentId ?? null,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "kbCategory",
    resourceId: id,
    diff: { name: data.name, slug },
  });

  revalidatePath("/app/help");
}

export async function deleteKbCategoryAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "delete");
  const cat = await loadCategory(id, ctx.workspaceId);
  if (!cat) throw new Error("Category not found");

  const [articleCount, childCount] = await Promise.all([
    prisma.kbArticle.count({
      where: { workspaceId: ctx.workspaceId, categoryId: id },
    }),
    prisma.kbCategory.count({
      where: { workspaceId: ctx.workspaceId, parentId: id },
    }),
  ]);
  if (articleCount > 0 || childCount > 0) {
    throw new Error(
      "Move articles and subcategories out before deleting this category",
    );
  }

  await prisma.kbCategory.delete({ where: { id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "kbCategory",
    resourceId: id,
    diff: { name: cat.name },
  });

  revalidatePath("/app/help");
}

export async function createKbArticleAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "create");
  const data = kbArticleSchema.parse(toFormObject(fd));

  if (data.categoryId) {
    const cat = await loadCategory(data.categoryId, ctx.workspaceId);
    if (!cat) throw new Error("Category not found");
  }

  const slug = await ensureUniqueArticleSlug(ctx.workspaceId, data.slug);
  const a = await prisma.kbArticle.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      body: data.body ?? "",
      categoryId: data.categoryId ?? null,
      authorId: ctx.userId,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "kbArticle",
    resourceId: a.id,
    diff: { title: a.title, slug: a.slug },
  });

  revalidatePath("/app/help");
  redirect(`/app/help/articles/${a.id}`);
}

export async function updateKbArticleAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "edit");
  const article = await loadArticle(id, ctx.workspaceId);
  if (!article) throw new Error("Article not found");
  const data = kbArticleSchema.parse(toFormObject(fd));

  if (data.categoryId) {
    const cat = await loadCategory(data.categoryId, ctx.workspaceId);
    if (!cat) throw new Error("Category not found");
  }

  const slug =
    data.slug && data.slug !== article.slug
      ? await ensureUniqueArticleSlug(ctx.workspaceId, data.slug, id)
      : article.slug;

  await prisma.kbArticle.update({
    where: { id },
    data: {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      body: data.body ?? "",
      categoryId: data.categoryId ?? null,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "kbArticle",
    resourceId: id,
    diff: { title: data.title, slug },
  });

  revalidatePath(`/app/help/articles/${id}`);
  revalidatePath("/app/help");
}

export async function transitionKbArticleAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "edit");
  const article = await loadArticle(id, ctx.workspaceId);
  if (!article) throw new Error("Article not found");
  const target = String(fd.get("status") ?? "") as KbArticleStatus;
  if (!canTransitionArticle(article.status, target)) {
    throw new Error(`Cannot transition from ${article.status} to ${target}`);
  }

  await prisma.kbArticle.update({
    where: { id },
    data: {
      status: target,
      publishedAt:
        target === "PUBLISHED" && !article.publishedAt
          ? new Date()
          : undefined,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "transition",
    resource: "kbArticle",
    resourceId: id,
    diff: { from: article.status, to: target },
  });

  revalidatePath(`/app/help/articles/${id}`);
  revalidatePath("/app/help");
}

export async function deleteKbArticleAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "kbArticle", "delete");
  const article = await loadArticle(id, ctx.workspaceId);
  if (!article) throw new Error("Article not found");
  if (article.status === "PUBLISHED") {
    throw new Error("Archive before deleting a published article");
  }

  await prisma.kbArticle.delete({ where: { id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "kbArticle",
    resourceId: id,
    diff: { title: article.title },
  });

  revalidatePath("/app/help");
  redirect("/app/help");
}
