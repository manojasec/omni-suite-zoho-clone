"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { recordAuditEvent } from "@/modules/audit/record";
import {
  questionSchema,
  surveySchema,
  validateAnswer,
} from "@/modules/surveys/schemas";

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return v == null ? "" : String(v);
}

async function loadOwned(id: string, workspaceId: string) {
  const survey = await prisma.survey.findFirst({ where: { id, workspaceId } });
  if (!survey) throw new Error("Survey not found");
  return survey;
}

export async function createSurveyAction(fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "create");
  const parsed = surveySchema.safeParse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    thankYouText: s(fd, "thankYouText"),
    closesAt: s(fd, "closesAt"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const survey = await prisma.survey.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      thankYouText: parsed.data.thankYouText ?? null,
      closesAt: parsed.data.closesAt ?? null,
      createdById: ctx.userId,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "create",
    resource: "survey",
    resourceId: survey.id,
    diff: { title: survey.title },
  });
  redirect(`/app/surveys/${survey.id}`);
}

export async function updateSurveyAction(id: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  await loadOwned(id, ctx.workspaceId);
  const parsed = surveySchema.safeParse({
    title: s(fd, "title"),
    description: s(fd, "description"),
    thankYouText: s(fd, "thankYouText"),
    closesAt: s(fd, "closesAt"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  await prisma.survey.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      thankYouText: parsed.data.thankYouText ?? null,
      closesAt: parsed.data.closesAt ?? null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "survey",
    resourceId: id,
    diff: { title: parsed.data.title },
  });
  revalidatePath(`/app/surveys/${id}`);
}

export async function publishSurveyAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  const survey = await loadOwned(id, ctx.workspaceId);
  const qCount = await prisma.surveyQuestion.count({ where: { surveyId: id } });
  if (qCount === 0) throw new Error("Add at least one question before publishing");
  if (survey.status === "PUBLISHED") return;
  await prisma.survey.update({ where: { id }, data: { status: "PUBLISHED" } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "survey",
    resourceId: id,
    diff: { status: "PUBLISHED" },
  });
  revalidatePath(`/app/surveys/${id}`);
}

export async function closeSurveyAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  await loadOwned(id, ctx.workspaceId);
  await prisma.survey.update({ where: { id }, data: { status: "CLOSED" } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "edit",
    resource: "survey",
    resourceId: id,
    diff: { status: "CLOSED" },
  });
  revalidatePath(`/app/surveys/${id}`);
}

export async function deleteSurveyAction(id: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "delete");
  const survey = await loadOwned(id, ctx.workspaceId);
  await prisma.survey.delete({ where: { id } });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "delete",
    resource: "survey",
    resourceId: id,
    diff: { title: survey.title },
  });
  redirect("/app/surveys");
}

export async function addQuestionAction(surveyId: string, fd: FormData) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  const survey = await loadOwned(surveyId, ctx.workspaceId);
  if (survey.status === "PUBLISHED" || survey.status === "CLOSED") {
    throw new Error("Cannot edit questions on a published survey");
  }
  const parsed = questionSchema.safeParse({
    type: s(fd, "type"),
    prompt: s(fd, "prompt"),
    helpText: s(fd, "helpText"),
    required: s(fd, "required") === "on",
    optionsText: s(fd, "optionsText"),
    ratingMax: s(fd, "ratingMax") || "5",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  const last = await prisma.surveyQuestion.findFirst({ where: { surveyId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? -1) + 1;
  await prisma.surveyQuestion.create({
    data: {
      surveyId,
      position,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      helpText: parsed.data.helpText ?? null,
      required: parsed.data.required,
      options: parsed.data.options,
      ratingMax: parsed.data.ratingMax,
    },
  });
  revalidatePath(`/app/surveys/${surveyId}`);
}

export async function deleteQuestionAction(questionId: string) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  const q = await prisma.surveyQuestion.findFirst({
    where: { id: questionId, survey: { workspaceId: ctx.workspaceId } },
    include: { survey: true },
  });
  if (!q) throw new Error("Question not found");
  if (q.survey.status === "PUBLISHED" || q.survey.status === "CLOSED") {
    throw new Error("Cannot edit questions on a published survey");
  }
  await prisma.surveyQuestion.delete({ where: { id: questionId } });
  revalidatePath(`/app/surveys/${q.surveyId}`);
}

export async function moveQuestionAction(questionId: string, direction: "up" | "down") {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "edit");
  const q = await prisma.surveyQuestion.findFirst({
    where: { id: questionId, survey: { workspaceId: ctx.workspaceId } },
  });
  if (!q) throw new Error("Question not found");
  const neighbor = await prisma.surveyQuestion.findFirst({
    where: {
      surveyId: q.surveyId,
      position: direction === "up" ? { lt: q.position } : { gt: q.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.surveyQuestion.update({ where: { id: q.id }, data: { position: neighbor.position } }),
    prisma.surveyQuestion.update({ where: { id: neighbor.id }, data: { position: q.position } }),
  ]);
  revalidatePath(`/app/surveys/${q.surveyId}`);
}

/**
 * Public submission action — no session required, called by /s/[slug] page.
 */
export async function submitSurveyResponseAction(slug: string, fd: FormData) {
  const survey = await prisma.survey.findUnique({
    where: { publicSlug: slug },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!survey) throw new Error("Survey not found");
  if (survey.status !== "PUBLISHED") throw new Error("Survey is not accepting responses");
  if (survey.closesAt && survey.closesAt.getTime() < Date.now()) throw new Error("Survey has closed");

  const respondent = (s(fd, "respondent") || "").trim().slice(0, 160) || null;
  const validated: Array<{ questionId: string; text: string | null; number: number | null; choices: string[] }> = [];

  for (const q of survey.questions) {
    const opts = Array.isArray(q.options) ? (q.options as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const raw = {
      text: s(fd, `q_${q.id}`),
      number: s(fd, `q_${q.id}`),
      choices: fd.getAll(`q_${q.id}`).map(String).filter(Boolean),
    };
    const result = validateAnswer(
      { type: q.type, required: q.required, options: opts, ratingMax: q.ratingMax },
      raw,
    );
    if (!result.ok) throw new Error(`${q.prompt}: ${result.message}`);
    validated.push({ questionId: q.id, ...result.value });
  }

  const response = await prisma.surveyResponse.create({
    data: {
      surveyId: survey.id,
      respondent,
      answers: {
        create: validated.map((a) => ({
          questionId: a.questionId,
          text: a.text,
          number: a.number,
          choices: a.choices,
        })),
      },
    },
  });

  redirect(`/s/${slug}/thanks?r=${response.id}`);
}
