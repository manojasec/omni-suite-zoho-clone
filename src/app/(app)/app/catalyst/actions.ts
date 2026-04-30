"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  DEFAULT_NODE_CODE,
  DEFAULT_PYTHON_CODE,
  functionSchema,
  invokeSchema,
  slugify,
} from "@/modules/catalyst/schemas";

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return v == null ? "" : String(v);
}

export async function createFunctionAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "create");

  const name = s(fd, "name");
  const runtime = s(fd, "runtime") || "NODE_20";
  const slugInput = s(fd, "slug") || slugify(name);
  const code =
    s(fd, "code") ||
    (runtime === "PYTHON_311" ? DEFAULT_PYTHON_CODE : DEFAULT_NODE_CODE);

  const parsed = functionSchema.parse({
    name,
    slug: slugInput,
    description: s(fd, "description"),
    runtime,
    handler:
      s(fd, "handler") ||
      (runtime === "PYTHON_311" ? "main.handler" : "index.handler"),
    code,
    timeoutMs: s(fd, "timeoutMs") || "30000",
    memoryMb: s(fd, "memoryMb") || "128",
  });

  const created = await prisma.catalystFunction.create({
    data: {
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description || null,
      runtime: parsed.runtime,
      handler: parsed.handler,
      code: parsed.code,
      timeoutMs: parsed.timeoutMs,
      memoryMb: parsed.memoryMb,
    },
    select: { id: true },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "catalyst.function.create",
    resource: "catalystFunction",
    resourceId: created.id,
    diff: { name: parsed.name, slug: parsed.slug, runtime: parsed.runtime },
  });

  revalidatePath("/app/catalyst");
  redirect(`/app/catalyst/${created.id}`);
}

export async function updateFunctionAction(functionId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "edit");

  const existing = await prisma.catalystFunction.findFirst({
    where: { id: functionId, workspaceId: ctx.workspaceId },
    select: { id: true, runtime: true },
  });
  if (!existing) throw new Error("Function not found");

  const parsed = functionSchema.parse({
    name: s(fd, "name"),
    slug: s(fd, "slug"),
    description: s(fd, "description"),
    runtime: s(fd, "runtime"),
    handler: s(fd, "handler"),
    code: s(fd, "code"),
    timeoutMs: s(fd, "timeoutMs") || "30000",
    memoryMb: s(fd, "memoryMb") || "128",
  });

  await prisma.catalystFunction.update({
    where: { id: functionId },
    data: {
      name: parsed.name,
      slug: parsed.slug,
      description: parsed.description || null,
      runtime: parsed.runtime,
      handler: parsed.handler,
      code: parsed.code,
      timeoutMs: parsed.timeoutMs,
      memoryMb: parsed.memoryMb,
    },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "catalyst.function.update",
    resource: "catalystFunction",
    resourceId: functionId,
  });

  revalidatePath(`/app/catalyst/${functionId}`);
}

export async function setFunctionStatusAction(
  functionId: string,
  status: "DRAFT" | "ACTIVE" | "DISABLED",
) {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "edit");

  const existing = await prisma.catalystFunction.findFirst({
    where: { id: functionId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Function not found");

  await prisma.catalystFunction.update({
    where: { id: functionId },
    data: { status },
  });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "catalyst.function.status",
    resource: "catalystFunction",
    resourceId: functionId,
    diff: { status },
  });

  revalidatePath(`/app/catalyst/${functionId}`);
}

export async function invokeFunctionAction(functionId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "edit");

  const fn = await prisma.catalystFunction.findFirst({
    where: { id: functionId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, name: true },
  });
  if (!fn) throw new Error("Function not found");
  if (fn.status !== "ACTIVE") {
    throw new Error("Function must be ACTIVE before it can be invoked");
  }

  const parsed = invokeSchema.parse({ payload: s(fd, "payload") });
  let input: unknown = null;
  if (parsed.payload) {
    try {
      input = JSON.parse(parsed.payload);
    } catch {
      input = { raw: parsed.payload };
    }
  }

  // Sandboxed execution is out of scope; we record a simulated invocation.
  const startedAt = Date.now();
  const durationMs = Math.floor(Math.random() * 80) + 20;
  await prisma.$transaction([
    prisma.catalystInvocation.create({
      data: {
        functionId,
        status: "SUCCESS",
        durationMs,
        input: input as object,
        output: { ok: true, echo: input as object },
        log: `[INFO] ${fn.name} invoked at ${new Date(
          startedAt,
        ).toISOString()}\n[INFO] returned in ${durationMs}ms`,
      },
    }),
    prisma.catalystFunction.update({
      where: { id: functionId },
      data: {
        invokeCount: { increment: 1 },
        lastInvokedAt: new Date(),
      },
    }),
  ]);

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "catalyst.function.invoke",
    resource: "catalystFunction",
    resourceId: functionId,
    diff: { durationMs },
  });

  revalidatePath(`/app/catalyst/${functionId}`);
}

export async function deleteFunctionAction(functionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "delete");

  const existing = await prisma.catalystFunction.findFirst({
    where: { id: functionId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) throw new Error("Function not found");

  await prisma.catalystFunction.delete({ where: { id: functionId } });

  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "catalyst.function.delete",
    resource: "catalystFunction",
    resourceId: functionId,
  });

  revalidatePath("/app/catalyst");
  redirect("/app/catalyst");
}
