"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { expenseCategorySchema } from "@/modules/expenses/schemas";
import { recordAuditEvent } from "@/modules/audit/record";

function fdToObj(fd: FormData) {
  return {
    name: fd.get("name") ?? "",
    code: fd.get("code") ?? "",
  };
}

export async function createExpenseCategoryAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expenseCategory", "create");
  const parsed = expenseCategorySchema.safeParse(fdToObj(fd));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const dup = await prisma.expenseCategory.findUnique({
    where: { workspaceId_name: { workspaceId: ctx.workspaceId, name: parsed.data.name } },
    select: { id: true },
  });
  if (dup) throw new Error("A category with this name already exists");

  const cat = await prisma.expenseCategory.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      code: parsed.data.code || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "expenseCategory",
    resourceId: cat.id,
  });
  revalidatePath("/app/expenses/categories");
}

export async function deleteExpenseCategoryAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "expenseCategory", "delete");
  const existing = await prisma.expenseCategory.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  // Soft archive instead of hard delete (categories may be linked to expenses)
  await prisma.expenseCategory.update({
    where: { id },
    data: { archived: true },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "archive",
    resource: "expenseCategory",
    resourceId: id,
  });
  revalidatePath("/app/expenses/categories");
}
