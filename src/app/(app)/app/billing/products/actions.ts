"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { productSchema } from "@/modules/billing/schemas";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    sku: fd.get("sku") ?? "",
    price: fd.get("price") ?? "0",
    taxPercent: fd.get("taxPercent") ?? "0",
  };
}

export async function createProductAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "product", "create");
  const parsed = productSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = await prisma.product.create({
    data: { workspaceId: ctx.workspaceId, ...parsed.data },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "product",
      resourceId: p.id,
    },
  });
  revalidatePath("/app/billing/products");
  redirect("/app/billing/products");
}

export async function updateProductAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "product", "edit");
  const parsed = productSchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const existing = await prisma.product.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.product.update({ where: { id }, data: parsed.data });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "product",
      resourceId: id,
    },
  });
  revalidatePath("/app/billing/products");
  return { ok: true };
}

export async function deleteProductAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "product", "delete");
  const existing = await prisma.product.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.product.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "product",
      resourceId: id,
    },
  });
  revalidatePath("/app/billing/products");
}
