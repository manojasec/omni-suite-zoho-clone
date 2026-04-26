"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  experimentSchema,
  variantsSchema,
  slugifyExperiment,
} from "@/modules/experiments/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

function variantsFromFd(fd: FormData) {
  const keys = fd.getAll("variant.key").map((v) => String(v));
  const labels = fd.getAll("variant.label").map((v) => String(v));
  const weights = fd.getAll("variant.weight").map((v) => String(v));
  const controlKey = s(fd, "controlKey");
  const out: Array<{ key: string; label: string; weight: number; isControl: boolean }> = [];
  for (let i = 0; i < keys.length; i += 1) {
    const k = (keys[i] ?? "").trim();
    if (!k) continue;
    out.push({
      key: k,
      label: (labels[i] ?? "").trim(),
      weight: Number.parseInt(weights[i] ?? "0", 10) || 0,
      isControl: k === controlKey,
    });
  }
  return out;
}

export async function createExperimentAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "create");

  const slug = slugifyExperiment(s(fd, "slug") || s(fd, "name"));
  const parsed = experimentSchema.safeParse({
    slug,
    name: s(fd, "name"),
    hypothesis: s(fd, "hypothesis"),
    primaryMetric: s(fd, "primaryMetric"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const variants = variantsFromFd(fd);
  const variantsParsed = variantsSchema.safeParse(variants);
  if (!variantsParsed.success) {
    throw new Error(variantsParsed.error.issues[0]?.message ?? "Invalid variants");
  }

  let experiment;
  try {
    experiment = await prisma.experiment.create({
      data: {
        workspaceId: ctx.workspaceId,
        slug: parsed.data.slug,
        name: parsed.data.name,
        hypothesis: parsed.data.hypothesis ?? null,
        primaryMetric: parsed.data.primaryMetric ?? null,
        variants: { create: variantsParsed.data },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("Experiment slug already exists");
    }
    throw e;
  }
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "experiment",
    resourceId: experiment.id,
    diff: { after: { slug: experiment.slug, name: experiment.name } },
  });
  revalidatePath("/app/experiments");
  redirect(`/app/experiments/${experiment.id}`);
}

async function loadExperiment(id: string, workspaceId: string) {
  const exp = await prisma.experiment.findFirst({ where: { id, workspaceId } });
  if (!exp) throw new Error("Experiment not found");
  return exp;
}

export async function startExperimentAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "edit");
  const exp = await loadExperiment(id, ctx.workspaceId);
  if (exp.status === "RUNNING") return;
  await prisma.experiment.update({
    where: { id },
    data: { status: "RUNNING", startedAt: exp.startedAt ?? new Date(), endedAt: null },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "experiment",
    resourceId: id,
    diff: { status: "RUNNING" },
  });
  revalidatePath("/app/experiments");
  revalidatePath(`/app/experiments/${id}`);
}

export async function pauseExperimentAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "edit");
  await loadExperiment(id, ctx.workspaceId);
  await prisma.experiment.update({ where: { id }, data: { status: "PAUSED" } });
  revalidatePath("/app/experiments");
  revalidatePath(`/app/experiments/${id}`);
}

export async function completeExperimentAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "edit");
  await loadExperiment(id, ctx.workspaceId);
  await prisma.experiment.update({
    where: { id },
    data: { status: "COMPLETED", endedAt: new Date() },
  });
  revalidatePath("/app/experiments");
  revalidatePath(`/app/experiments/${id}`);
}

export async function deleteExperimentAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "delete");
  await loadExperiment(id, ctx.workspaceId);
  await prisma.experiment.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "experiment",
    resourceId: id,
  });
  revalidatePath("/app/experiments");
  redirect("/app/experiments");
}
