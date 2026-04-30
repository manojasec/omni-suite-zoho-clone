"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  changelogEntrySchema,
  slugifyTitle,
} from "@/modules/changelog/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

async function uniqueSlug(workspaceId: string, base: string, excludeId?: string) {
  let candidate = base;
  let n = 2;
  while (true) {
    const collision = await prisma.changelogEntry.findFirst({
      where: {
        workspaceId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!collision) return candidate;
    candidate = `${base}-${n}`.slice(0, 200);
    n += 1;
    if (n > 50) throw new Error("Could not generate a unique slug");
  }
}

export async function createEntryAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "changelog", "create");

  const slugInput = s(fd, "slug").trim();
  const title = s(fd, "title").trim();
  const slugBase = slugInput || slugifyTitle(title);
  if (!slugBase) throw new Error("Slug required");

  const parsed = changelogEntrySchema.safeParse({
    title,
    slug: slugBase,
    excerpt: s(fd, "excerpt"),
    body: s(fd, "body"),
    type: s(fd, "type") || "FEATURE",
    status: s(fd, "status") || "DRAFT",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const finalSlug = await uniqueSlug(ctx.workspaceId, parsed.data.slug);
  const isPublishing = parsed.data.status === "PUBLISHED";

  const created = await prisma.changelogEntry.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: parsed.data.title,
      slug: finalSlug,
      excerpt: parsed.data.excerpt || null,
      body: parsed.data.body,
      type: parsed.data.type,
      status: parsed.data.status,
      authorId: ctx.userId,
      publishedAt: isPublishing ? new Date() : null,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "changelog.entry.create",
    resource: "changelogEntry",
    resourceId: created.id,
    diff: { title: parsed.data.title, slug: finalSlug, status: parsed.data.status },
  });

  revalidatePath("/app/changelog");
  redirect(`/app/changelog/${created.id}`);
}

export async function updateEntryAction(entryId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "changelog", "edit");

  const existing = await prisma.changelogEntry.findFirst({
    where: { id: entryId, workspaceId: ctx.workspaceId },
  });
  if (!existing) throw new Error("Entry not found");

  const parsed = changelogEntrySchema.safeParse({
    title: s(fd, "title"),
    slug: s(fd, "slug").trim() || existing.slug,
    excerpt: s(fd, "excerpt"),
    body: s(fd, "body"),
    type: s(fd, "type") || existing.type,
    status: s(fd, "status") || existing.status,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const finalSlug =
    parsed.data.slug === existing.slug
      ? existing.slug
      : await uniqueSlug(ctx.workspaceId, parsed.data.slug, entryId);

  const goingLive =
    parsed.data.status === "PUBLISHED" && existing.status !== "PUBLISHED";

  await prisma.changelogEntry.update({
    where: { id: entryId },
    data: {
      title: parsed.data.title,
      slug: finalSlug,
      excerpt: parsed.data.excerpt || null,
      body: parsed.data.body,
      type: parsed.data.type,
      status: parsed.data.status,
      publishedAt: goingLive ? new Date() : existing.publishedAt,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "changelog.entry.update",
    resource: "changelogEntry",
    resourceId: entryId,
    diff: { from: existing.status, to: parsed.data.status },
  });

  revalidatePath("/app/changelog");
  revalidatePath(`/app/changelog/${entryId}`);
}

export async function deleteEntryAction(entryId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "changelog", "delete");

  const existing = await prisma.changelogEntry.findFirst({
    where: { id: entryId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Entry not found");

  await prisma.changelogEntry.delete({ where: { id: entryId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "changelog.entry.delete",
    resource: "changelogEntry",
    resourceId: entryId,
  });

  revalidatePath("/app/changelog");
  redirect("/app/changelog");
}
