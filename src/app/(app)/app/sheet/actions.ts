"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  sheetCellSchema,
  sheetSchema,
  type SheetStatus,
} from "@/modules/sheet/schemas";

function toFormObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function loadSheet(id: string, workspaceId: string) {
  return prisma.sheet.findFirst({ where: { id, workspaceId } });
}

export async function createSheetAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "create");
  const data = sheetSchema.parse(toFormObject(fd));

  const s = await prisma.sheet.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: data.name,
      description: data.description || null,
      rowCount: data.rowCount,
      colCount: data.colCount,
      ownerId: ctx.userId,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "sheet",
    resourceId: s.id,
    diff: { name: s.name },
  });

  revalidatePath("/app/sheet");
  redirect(`/app/sheet/${s.id}`);
}

export async function updateSheetAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "edit");
  const sheet = await loadSheet(id, ctx.workspaceId);
  if (!sheet) throw new Error("Sheet not found");
  const data = sheetSchema.parse(toFormObject(fd));

  await prisma.sheet.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description || null,
      rowCount: data.rowCount,
      colCount: data.colCount,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "sheet",
    resourceId: id,
    diff: { name: data.name },
  });

  revalidatePath(`/app/sheet/${id}`);
  revalidatePath("/app/sheet");
}

export async function setSheetStatusAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "edit");
  const sheet = await loadSheet(id, ctx.workspaceId);
  if (!sheet) throw new Error("Sheet not found");
  const status = String(fd.get("status") ?? "") as SheetStatus;
  if (status !== "ACTIVE" && status !== "ARCHIVED") {
    throw new Error("Invalid status");
  }
  await prisma.sheet.update({ where: { id }, data: { status } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "transition",
    resource: "sheet",
    resourceId: id,
    diff: { status },
  });

  revalidatePath(`/app/sheet/${id}`);
  revalidatePath("/app/sheet");
}

export async function deleteSheetAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "delete");
  const sheet = await loadSheet(id, ctx.workspaceId);
  if (!sheet) throw new Error("Sheet not found");

  await prisma.sheet.delete({ where: { id } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "sheet",
    resourceId: id,
    diff: { name: sheet.name },
  });

  revalidatePath("/app/sheet");
  redirect("/app/sheet");
}

export async function setSheetCellAction(sheetId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "edit");
  const sheet = await loadSheet(sheetId, ctx.workspaceId);
  if (!sheet) throw new Error("Sheet not found");
  const data = sheetCellSchema.parse(toFormObject(fd));
  if (data.row >= sheet.rowCount || data.col >= sheet.colCount) {
    throw new Error("Cell is outside sheet bounds");
  }
  const value = data.value ?? "";
  const isFormula = value.startsWith("=");

  if (value === "") {
    await prisma.sheetCell.deleteMany({
      where: { sheetId, row: data.row, col: data.col },
    });
  } else {
    await prisma.sheetCell.upsert({
      where: {
        sheetId_row_col: {
          sheetId,
          row: data.row,
          col: data.col,
        },
      },
      create: {
        sheetId,
        row: data.row,
        col: data.col,
        value,
        formula: isFormula ? value : null,
      },
      update: {
        value,
        formula: isFormula ? value : null,
      },
    });
  }

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "sheetCell",
    resourceId: `${sheetId}:${data.row}:${data.col}`,
    diff: { value },
  });

  revalidatePath(`/app/sheet/${sheetId}`);
}

export async function clearSheetAction(sheetId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "edit");
  const sheet = await loadSheet(sheetId, ctx.workspaceId);
  if (!sheet) throw new Error("Sheet not found");

  await prisma.sheetCell.deleteMany({ where: { sheetId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "clear",
    resource: "sheet",
    resourceId: sheetId,
  });

  revalidatePath(`/app/sheet/${sheetId}`);
}
