"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { formSchema, fieldDefSchema, buildSubmissionSchema, type FieldDef } from "@/modules/forms/schemas";
import { LifecycleStage } from "@prisma/client";
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";

function parseFieldsFromFd(fd: FormData): FieldDef[] {
  const ids = fd.getAll("f_id").map(String);
  const types = fd.getAll("f_type").map(String);
  const labels = fd.getAll("f_label").map(String);
  const names = fd.getAll("f_name").map(String);
  const required = fd.getAll("f_required").map((v) => v === "on" || v === "true" || v === "1");
  const placeholders = fd.getAll("f_placeholder").map(String);
  const optionsRaw = fd.getAll("f_options").map(String);
  const out: FieldDef[] = [];
  for (let i = 0; i < ids.length; i++) {
    const parsed = fieldDefSchema.safeParse({
      id: ids[i],
      type: types[i],
      label: labels[i] ?? "",
      name: names[i] ?? "",
      required: required[i] ?? false,
      placeholder: placeholders[i] ?? "",
      options: (optionsRaw[i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function createFormAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "form", "create");
  try {
    await assertWithinPlanLimit(ctx.workspaceId, "forms");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }
  const fields = parseFieldsFromFd(fd);
  const parsed = formSchema.safeParse({
    name: fd.get("name") ?? "",
    destination: fd.get("destination") ?? "submission",
    isPublished: fd.get("isPublished"),
    fields,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const created = await prisma.form.create({
    data: {
      workspaceId: ctx.workspaceId,
      name: parsed.data.name,
      destination: parsed.data.destination,
      isPublished: parsed.data.isPublished,
      schema: { fields: parsed.data.fields },
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "create",
      resource: "form",
      resourceId: created.id,
    },
  });
  revalidatePath("/app/forms");
  redirect(`/app/forms/${created.id}`);
}

export async function updateFormAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "form", "edit");
  const fields = parseFieldsFromFd(fd);
  const parsed = formSchema.safeParse({
    name: fd.get("name") ?? "",
    destination: fd.get("destination") ?? "submission",
    isPublished: fd.get("isPublished"),
    fields,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const existing = await prisma.form.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return { error: "Not found" };
  await prisma.form.update({
    where: { id },
    data: {
      name: parsed.data.name,
      destination: parsed.data.destination,
      isPublished: parsed.data.isPublished,
      schema: { fields: parsed.data.fields },
    },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "update",
      resource: "form",
      resourceId: id,
    },
  });
  revalidatePath(`/app/forms/${id}`);
  revalidatePath("/app/forms");
  return { ok: true };
}

export async function deleteFormAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "form", "delete");
  const existing = await prisma.form.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.form.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "delete",
      resource: "form",
      resourceId: id,
    },
  });
  revalidatePath("/app/forms");
  redirect("/app/forms");
}

/**
 * Public submission entry point. Validates against the form's stored schema,
 * stores the FormSubmission, and (if destination=lead/contact) creates a
 * Contact in the workspace.
 */
export async function submitFormAction(publicId: string, fd: FormData) {
  const form = await prisma.form.findUnique({
    where: { publicId },
    select: {
      id: true,
      workspaceId: true,
      destination: true,
      isPublished: true,
      schema: true,
    },
  });
  if (!form || !form.isPublished) return { error: "Form not available" };

  // Honeypot — bots will fill this hidden field.
  if (typeof fd.get("hp_url") === "string" && (fd.get("hp_url") as string).length > 0) {
    return { ok: true };
  }

  const fields = ((form.schema as { fields?: FieldDef[] })?.fields ?? []) as FieldDef[];
  const raw: Record<string, FormDataEntryValue | null> = {};
  for (const f of fields) raw[f.name] = fd.get(f.name);

  const submissionSchema = buildSubmissionSchema(fields);
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      payload: parsed.data,
    },
  });

  if (form.destination === "lead" || form.destination === "contact") {
    const data = parsed.data as Record<string, unknown>;
    const fieldByName = Object.fromEntries(fields.map((f) => [f.name, f]));
    const findValue = (predicate: (f: FieldDef) => boolean): string | null => {
      const f = fields.find(predicate);
      if (!f) return null;
      const v = data[f.name];
      return typeof v === "string" && v.length > 0 ? v : null;
    };
    const email = findValue((f) => f.type === "email") ?? null;
    const firstName =
      findValue((f) => /first/i.test(f.label) || /first/i.test(f.name)) ??
      findValue((f) => /^name$/i.test(f.name) || /^name$/i.test(f.label)) ??
      "Lead";
    const lastName = findValue((f) => /last/i.test(f.label) || /last/i.test(f.name));
    const phone = findValue((f) => f.type === "phone");
    fieldByName; // silence unused

    await prisma.contact.create({
      data: {
        workspaceId: form.workspaceId,
        firstName,
        lastName,
        email,
        phone,
        lifecycleStage: form.destination === "lead" ? LifecycleStage.LEAD : LifecycleStage.LEAD,
        source: "form",
      },
    });
  }

  return { ok: true, submissionId: submission.id };
}
