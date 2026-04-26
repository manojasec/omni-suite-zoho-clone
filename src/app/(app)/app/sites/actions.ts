"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { siteSchema, sitePageSchema, slugify } from "@/modules/sites/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function loadSite(id: string, workspaceId: string) {
  const site = await prisma.site.findFirst({ where: { id, workspaceId } });
  if (!site) throw new Error("Site not found");
  return site;
}

export async function createSiteAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "create");
  const slugRaw = s(fd, "slug").trim() || s(fd, "name");
  const parsed = siteSchema.safeParse({
    slug: slugify(slugRaw),
    name: s(fd, "name"),
    description: s(fd, "description"),
    themeColor: s(fd, "themeColor") || "#0f172a",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let site;
  try {
    site = await prisma.site.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        themeColor: parsed.data.themeColor,
        pages: {
          create: {
            slug: "home",
            title: parsed.data.name,
            body: `# Welcome to ${parsed.data.name}\n\nUse the editor to add content to this page.`,
            status: "DRAFT",
            isHome: true,
            position: 0,
            updatedById: ctx.userId,
          },
        },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Site slug already in use");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "site",
    resourceId: site.id,
    diff: { after: { slug: site.slug, name: site.name } },
  });
  revalidatePath("/app/sites");
  redirect(`/app/sites/${site.id}`);
}

export async function updateSiteAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "edit");
  const site = await loadSite(id, ctx.workspaceId);

  const parsed = siteSchema.safeParse({
    slug: slugify(s(fd, "slug") || site.slug),
    name: s(fd, "name"),
    description: s(fd, "description"),
    themeColor: s(fd, "themeColor") || site.themeColor,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    await prisma.site.update({
      where: { id },
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        themeColor: parsed.data.themeColor,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Site slug already in use");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "site",
    resourceId: id,
    diff: { before: { slug: site.slug, name: site.name }, after: parsed.data },
  });
  revalidatePath("/app/sites");
  revalidatePath(`/app/sites/${id}`);
  redirect(`/app/sites/${id}`);
}

export async function publishSiteAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "edit");
  const site = await loadSite(id, ctx.workspaceId);
  await prisma.site.update({ where: { id }, data: { published: !site.published } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: site.published ? "unpublish" : "publish",
    resource: "site",
    resourceId: id,
  });
  revalidatePath("/app/sites");
  revalidatePath(`/app/sites/${id}`);
}

export async function deleteSiteAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "site", "delete");
  const site = await loadSite(id, ctx.workspaceId);
  await prisma.site.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "site",
    resourceId: id,
    diff: { before: { slug: site.slug, name: site.name } },
  });
  revalidatePath("/app/sites");
  redirect("/app/sites");
}

// ---------- Pages ----------

async function loadPage(siteId: string, pageId: string, workspaceId: string) {
  const page = await prisma.sitePage.findFirst({
    where: { id: pageId, siteId, site: { workspaceId } },
  });
  if (!page) throw new Error("Page not found");
  return page;
}

export async function createSitePageAction(siteId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sitePage", "create");
  const site = await loadSite(siteId, ctx.workspaceId);

  const parsed = sitePageSchema.safeParse({
    slug: slugify(s(fd, "slug") || s(fd, "title")),
    title: s(fd, "title"),
    body: s(fd, "body") || `# ${s(fd, "title") || "New page"}\n\n`,
    status: s(fd, "status") || "DRAFT",
    isHome: s(fd, "isHome") === "on",
    position: Number(s(fd, "position") || 0),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  let page;
  try {
    page = await prisma.sitePage.create({
      data: {
        siteId: site.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        body: parsed.data.body,
        status: parsed.data.status,
        isHome: false, // Home is set via setHome action only.
        position: parsed.data.position,
        updatedById: ctx.userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Page slug already in use for this site");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "sitePage",
    resourceId: page.id,
    diff: { after: { siteId: site.id, slug: page.slug, title: page.title } },
  });
  revalidatePath(`/app/sites/${siteId}`);
  redirect(`/app/sites/${siteId}/pages/${page.id}`);
}

export async function updateSitePageAction(siteId: string, pageId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sitePage", "edit");
  const page = await loadPage(siteId, pageId, ctx.workspaceId);

  const parsed = sitePageSchema.safeParse({
    slug: slugify(s(fd, "slug") || page.slug),
    title: s(fd, "title"),
    body: s(fd, "body"),
    status: s(fd, "status") || page.status,
    isHome: s(fd, "isHome") === "on",
    position: Number(s(fd, "position") || page.position),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    await prisma.sitePage.update({
      where: { id: pageId },
      data: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        body: parsed.data.body,
        status: parsed.data.status,
        position: parsed.data.position,
        updatedById: ctx.userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Page slug already in use for this site");
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "sitePage",
    resourceId: pageId,
    diff: { before: { slug: page.slug, title: page.title, status: page.status }, after: parsed.data },
  });
  revalidatePath(`/app/sites/${siteId}`);
  revalidatePath(`/app/sites/${siteId}/pages/${pageId}`);
  redirect(`/app/sites/${siteId}/pages/${pageId}`);
}

export async function setSiteHomePageAction(siteId: string, pageId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sitePage", "edit");
  const page = await loadPage(siteId, pageId, ctx.workspaceId);
  await prisma.$transaction([
    prisma.sitePage.updateMany({ where: { siteId, isHome: true }, data: { isHome: false } }),
    prisma.sitePage.update({ where: { id: page.id }, data: { isHome: true } }),
  ]);
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "set-home",
    resource: "sitePage",
    resourceId: page.id,
  });
  revalidatePath(`/app/sites/${siteId}`);
}

export async function deleteSitePageAction(siteId: string, pageId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sitePage", "delete");
  const page = await loadPage(siteId, pageId, ctx.workspaceId);
  if (page.isHome) {
    throw new Error("Cannot delete the home page. Set another page as home first.");
  }
  await prisma.sitePage.delete({ where: { id: pageId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "sitePage",
    resourceId: pageId,
    diff: { before: { slug: page.slug, title: page.title } },
  });
  revalidatePath(`/app/sites/${siteId}`);
  redirect(`/app/sites/${siteId}`);
}
