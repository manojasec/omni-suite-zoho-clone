"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  canTransitionApp,
  coerceRecordData,
  creatorAppSchema,
  creatorEntitySchema,
  creatorFieldSchema,
  parseSelectOptions,
  validateRecordData,
  type CreatorAppStatus,
  type FieldDef,
} from "@/modules/creator/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadApp(id: string, workspaceId: string) {
  return prisma.creatorApp.findFirst({ where: { id, workspaceId } });
}

async function loadEntity(id: string, workspaceId: string) {
  return prisma.creatorEntity.findFirst({
    where: { id, app: { workspaceId } },
    include: { app: true, fields: { orderBy: { position: "asc" } } },
  });
}

export async function createCreatorAppAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "create");
  const data = creatorAppSchema.parse(toFormObject(fd));

  let appId: string;
  try {
    const app = await prisma.creatorApp.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        status: "DRAFT",
      },
    });
    appId = app.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`An app with slug "${data.slug}" already exists.`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "creatorApp",
    resourceId: appId,
    diff: { after: data },
  });
  revalidatePath("/app/creator");
  redirect(`/app/creator/${appId}`);
}

export async function updateCreatorAppAction(appId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const app = await loadApp(appId, ctx.workspaceId);
  if (!app) throw new Error("App not found");
  const data = creatorAppSchema.parse(toFormObject(fd));

  try {
    await prisma.creatorApp.update({
      where: { id: appId },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`An app with slug "${data.slug}" already exists.`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "creatorApp",
    resourceId: appId,
    diff: { before: { name: app.name, slug: app.slug }, after: data },
  });
  revalidatePath(`/app/creator/${appId}`);
}

export async function transitionCreatorAppAction(appId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const app = await loadApp(appId, ctx.workspaceId);
  if (!app) throw new Error("App not found");
  const to = String(fd.get("status") ?? "") as CreatorAppStatus;
  if (!canTransitionApp(app.status, to))
    throw new Error(`Cannot transition ${app.status} → ${to}`);

  await prisma.creatorApp.update({
    where: { id: appId },
    data: { status: to },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "transition",
    resource: "creatorApp",
    resourceId: appId,
    diff: { from: app.status, to },
  });
  revalidatePath(`/app/creator/${appId}`);
}

export async function deleteCreatorAppAction(appId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "delete");
  const app = await loadApp(appId, ctx.workspaceId);
  if (!app) throw new Error("App not found");
  if (app.status === "PUBLISHED")
    throw new Error("Archive the app before deleting.");

  await prisma.creatorApp.delete({ where: { id: appId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "creatorApp",
    resourceId: appId,
    diff: { before: { name: app.name, slug: app.slug } },
  });
  revalidatePath("/app/creator");
  redirect("/app/creator");
}

export async function createCreatorEntityAction(appId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const app = await loadApp(appId, ctx.workspaceId);
  if (!app) throw new Error("App not found");
  const data = creatorEntitySchema.parse(toFormObject(fd));

  const last = await prisma.creatorEntity.findFirst({
    where: { appId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  let entityId: string;
  try {
    const e = await prisma.creatorEntity.create({
      data: {
        appId,
        key: data.key,
        label: data.label,
        description: data.description,
        position: (last?.position ?? -1) + 1,
      },
    });
    entityId = e.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`An entity with key "${data.key}" already exists.`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "creatorApp",
    resourceId: appId,
    diff: { entity: { id: entityId, key: data.key } },
  });
  revalidatePath(`/app/creator/${appId}`);
}

export async function deleteCreatorEntityAction(entityId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const entity = await loadEntity(entityId, ctx.workspaceId);
  if (!entity) throw new Error("Entity not found");

  await prisma.creatorEntity.delete({ where: { id: entityId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "creatorApp",
    resourceId: entity.appId,
    diff: { entity: { id: entityId, key: entity.key } },
  });
  revalidatePath(`/app/creator/${entity.appId}`);
}

export async function createCreatorFieldAction(entityId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const entity = await loadEntity(entityId, ctx.workspaceId);
  if (!entity) throw new Error("Entity not found");
  const data = creatorFieldSchema.parse(toFormObject(fd));

  const last = await prisma.creatorField.findFirst({
    where: { entityId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const options =
    data.kind === "SELECT" ? parseSelectOptions(data.options) : null;

  try {
    await prisma.creatorField.create({
      data: {
        entityId,
        key: data.key,
        label: data.label,
        kind: data.kind,
        required: data.required,
        helpText: data.helpText,
        options: options as Prisma.InputJsonValue | undefined,
        position: (last?.position ?? -1) + 1,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(`A field with key "${data.key}" already exists.`);
    }
    throw e;
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "creatorApp",
    resourceId: entity.appId,
    diff: { field: { entityId, key: data.key, kind: data.kind } },
  });
  revalidatePath(`/app/creator/${entity.appId}/entities/${entityId}`);
}

export async function deleteCreatorFieldAction(fieldId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "edit");
  const field = await prisma.creatorField.findFirst({
    where: { id: fieldId, entity: { app: { workspaceId: ctx.workspaceId } } },
    include: { entity: true },
  });
  if (!field) throw new Error("Field not found");

  await prisma.creatorField.delete({ where: { id: fieldId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "creatorApp",
    resourceId: field.entity.appId,
    diff: { field: { id: fieldId, key: field.key } },
  });
  revalidatePath(
    `/app/creator/${field.entity.appId}/entities/${field.entityId}`,
  );
}

export async function createCreatorRecordAction(
  entityId: string,
  fd: FormData,
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorRecord", "create");
  const entity = await loadEntity(entityId, ctx.workspaceId);
  if (!entity) throw new Error("Entity not found");

  const fieldDefs: FieldDef[] = entity.fields.map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
  }));

  const formObj = toFormObject(fd);
  const data = coerceRecordData(fieldDefs, formObj);
  const issues = validateRecordData(fieldDefs, data);
  if (issues.length > 0)
    throw new Error(
      issues.map((i) => `${i.field}: ${i.message}`).join("; "),
    );

  const rec = await prisma.creatorRecord.create({
    data: {
      entityId,
      workspaceId: ctx.workspaceId,
      data: data as Prisma.InputJsonValue,
      createdById: ctx.userId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "creatorRecord",
    resourceId: rec.id,
    diff: { entity: entity.key },
  });
  revalidatePath(`/app/creator/${entity.appId}/entities/${entityId}`);
}

export async function deleteCreatorRecordAction(recordId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorRecord", "delete");
  const rec = await prisma.creatorRecord.findFirst({
    where: { id: recordId, workspaceId: ctx.workspaceId },
    include: { entity: { select: { id: true, appId: true } } },
  });
  if (!rec) throw new Error("Record not found");

  await prisma.creatorRecord.delete({ where: { id: recordId } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "creatorRecord",
    resourceId: recordId,
    diff: { entityId: rec.entityId },
  });
  revalidatePath(
    `/app/creator/${rec.entity.appId}/entities/${rec.entityId}`,
  );
}
