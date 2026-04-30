"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { taxRateSchema } from "@/modules/tax-rates/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

function parse(fd: FormData) {
  return taxRateSchema.parse({
    name: s(fd, "name"),
    rate: s(fd, "rate"),
    region: s(fd, "region"),
    isInclusive: fd.get("isInclusive") === "on",
    isDefault: fd.get("isDefault") === "on",
  });
}

export async function createTaxRateAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "taxRate", "create");
  const data = parse(fd);

  const created = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.taxRate.updateMany({
        where: { workspaceId: ctx.workspaceId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.taxRate.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        rate: data.rate,
        region: data.region || null,
        isInclusive: data.isInclusive,
        isDefault: data.isDefault,
      },
      select: { id: true },
    });
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "taxRate.create",
    resource: "taxRate",
    resourceId: created.id,
    diff: { name: data.name, rate: data.rate },
  });

  revalidatePath("/app/tax-rates");
  redirect("/app/tax-rates");
}

export async function updateTaxRateAction(taxRateId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "taxRate", "edit");

  const existing = await prisma.taxRate.findFirst({
    where: { id: taxRateId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Tax rate not found");

  const data = parse(fd);

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.taxRate.updateMany({
        where: {
          workspaceId: ctx.workspaceId,
          isDefault: true,
          NOT: { id: taxRateId },
        },
        data: { isDefault: false },
      });
    }
    await tx.taxRate.update({
      where: { id: taxRateId },
      data: {
        name: data.name,
        rate: data.rate,
        region: data.region || null,
        isInclusive: data.isInclusive,
        isDefault: data.isDefault,
      },
    });
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "taxRate.update",
    resource: "taxRate",
    resourceId: taxRateId,
    diff: { rate: data.rate },
  });

  revalidatePath("/app/tax-rates");
}

export async function archiveTaxRateAction(taxRateId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "taxRate", "delete");

  const existing = await prisma.taxRate.findFirst({
    where: { id: taxRateId, workspaceId: ctx.workspaceId },
    select: { id: true, isArchived: true },
  });
  if (!existing) throw new Error("Tax rate not found");

  await prisma.taxRate.update({
    where: { id: taxRateId },
    data: { isArchived: !existing.isArchived },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: existing.isArchived ? "taxRate.unarchive" : "taxRate.archive",
    resource: "taxRate",
    resourceId: taxRateId,
  });

  revalidatePath("/app/tax-rates");
}
