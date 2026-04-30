"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import { datasetSchema, ruleSchema } from "@/modules/dataprep/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createDatasetAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "create");
  const parsed = datasetSchema.parse({
    name: s(fd, "name"),
    description: s(fd, "description"),
    sourceType: s(fd, "sourceType") || "csv",
  });

  const created = await prisma.dataPrepDataset.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.name,
      description: parsed.description || null,
      sourceType: parsed.sourceType,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "dataprep.dataset.create",
    resource: "dataPrepDataset",
    resourceId: created.id,
    diff: { name: parsed.name },
  });

  revalidatePath("/app/dataprep");
  redirect(`/app/dataprep/${created.id}`);
}

export async function addRuleAction(datasetId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "edit");

  const dataset = await prisma.dataPrepDataset.findFirst({
    where: { id: datasetId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!dataset) throw new Error("Dataset not found");

  const parsed = ruleSchema.parse({
    kind: s(fd, "kind"),
    column: s(fd, "column"),
  });

  const last = await prisma.dataPrepRule.findFirst({
    where: { datasetId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.dataPrepRule.create({
    data: {
      datasetId,
      kind: parsed.kind,
      column: parsed.column || null,
      position: (last?.position ?? -1) + 1,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "dataprep.rule.add",
    resource: "dataPrepDataset",
    resourceId: datasetId,
    diff: { kind: parsed.kind, column: parsed.column },
  });

  revalidatePath(`/app/dataprep/${datasetId}`);
}

export async function deleteRuleAction(datasetId: string, ruleId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "edit");

  const dataset = await prisma.dataPrepDataset.findFirst({
    where: { id: datasetId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!dataset) throw new Error("Dataset not found");

  await prisma.dataPrepRule.deleteMany({
    where: { id: ruleId, datasetId },
  });

  revalidatePath(`/app/dataprep/${datasetId}`);
}

export async function runDatasetAction(datasetId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "edit");

  const dataset = await prisma.dataPrepDataset.findFirst({
    where: { id: datasetId, workspaceId: ctx.workspaceId },
    select: { id: true, rowCount: true },
  });
  if (!dataset) throw new Error("Dataset not found");

  const rules = await prisma.dataPrepRule.count({ where: { datasetId } });

  // Simulate a run: rows-after derived from rules count (REMOVE_DUPLICATES halves rows).
  const before = dataset.rowCount || 1000;
  const after = Math.max(0, before - rules * 5);

  await prisma.$transaction([
    prisma.dataPrepRun.create({
      data: {
        datasetId,
        status: "READY",
        rowsBefore: before,
        rowsAfter: after,
        rulesApplied: rules,
        finishedAt: new Date(),
      },
    }),
    prisma.dataPrepDataset.update({
      where: { id: datasetId },
      data: { status: "READY", rowCount: after },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "dataprep.dataset.run",
    resource: "dataPrepDataset",
    resourceId: datasetId,
    diff: { before, after, rules },
  });

  revalidatePath(`/app/dataprep/${datasetId}`);
}

export async function deleteDatasetAction(datasetId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "delete");

  const existing = await prisma.dataPrepDataset.findFirst({
    where: { id: datasetId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Dataset not found");

  await prisma.dataPrepDataset.delete({ where: { id: datasetId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "dataprep.dataset.delete",
    resource: "dataPrepDataset",
    resourceId: datasetId,
  });

  revalidatePath("/app/dataprep");
  redirect("/app/dataprep");
}
