"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { pivotReportSchema } from "@/modules/pivots/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

function parsePivotForm(fd: FormData) {
  return pivotReportSchema.safeParse({
    name: s(fd, "name"),
    description: s(fd, "description"),
    source: s(fd, "source"),
    rowField: s(fd, "rowField"),
    colField: s(fd, "colField"),
    valueMetric: s(fd, "valueMetric") || "COUNT",
    valueField: s(fd, "valueField"),
    rangeDays: s(fd, "rangeDays") || "30",
  });
}

export async function createPivotReportAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "create");
  const parsed = parsePivotForm(fd);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const created = await prisma.pivotReport.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      source: parsed.data.source,
      rowField: parsed.data.rowField,
      colField: parsed.data.colField ?? null,
      valueMetric: parsed.data.valueMetric,
      valueField: parsed.data.valueField ?? null,
      rangeDays: parsed.data.rangeDays,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "pivotReport",
    resourceId: created.id,
    diff: { name: created.name, source: created.source },
  });
  redirect(`/app/reports/pivots/${created.id}`);
}

export async function updatePivotReportAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "edit");
  const existing = await prisma.pivotReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Pivot report not found");
  const parsed = parsePivotForm(fd);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.pivotReport.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      source: parsed.data.source,
      rowField: parsed.data.rowField,
      colField: parsed.data.colField ?? null,
      valueMetric: parsed.data.valueMetric,
      valueField: parsed.data.valueField ?? null,
      rangeDays: parsed.data.rangeDays,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "pivotReport",
    resourceId: id,
    diff: { name: parsed.data.name },
  });
  revalidatePath(`/app/reports/pivots/${id}`);
}

export async function deletePivotReportAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "delete");
  const existing = await prisma.pivotReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) throw new Error("Pivot report not found");
  await prisma.pivotReport.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "pivotReport",
    resourceId: id,
    diff: { name: existing.name },
  });
  redirect("/app/reports/pivots");
}
