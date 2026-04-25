"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { companySchema } from "@/modules/crm/schemas";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    domain: fd.get("domain") ?? "",
    industry: fd.get("industry") ?? "",
    size: fd.get("size") ?? "",
  };
}

export async function createCompanyAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "company", "create");
  const parsed = companySchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const company = await prisma.company.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      domain: data.domain,
      industry: data.industry,
      size: data.size,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "company",
      resourceId: company.id,
    },
  });
  revalidatePath("/app/crm/companies");
  redirect(`/app/crm/companies/${company.id}`);
}

export async function updateCompanyAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "company", "edit");
  const parsed = companySchema.safeParse(fdToObj(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.company.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };

  const data = parsed.data;
  await prisma.company.update({
    where: { id },
    data: {
      name: data.name,
      domain: data.domain,
      industry: data.industry,
      size: data.size,
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "company",
      resourceId: id,
    },
  });
  revalidatePath(`/app/crm/companies/${id}`);
  revalidatePath("/app/crm/companies");
  return { ok: true };
}

export async function deleteCompanyAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "company", "delete");
  const existing = await prisma.company.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.company.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "company",
      resourceId: id,
    },
  });
  revalidatePath("/app/crm/companies");
  redirect("/app/crm/companies");
}
