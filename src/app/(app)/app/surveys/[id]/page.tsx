import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  questionUsesOptions,
  questionUsesRating,
} from "@/modules/surveys/schemas";
import {
  addQuestionAction,
  closeSurveyAction,
  deleteQuestionAction,
  deleteSurveyAction,
  moveQuestionAction,
  publishSurveyAction,
  updateSurveyAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "view");
  const { id } = await params;
  const survey = await prisma.survey.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      questions: { orderBy: { position: "asc" } },
      _count: { select: { responses: true } },
    },
  });
  if (!survey) notFound();
  const canEdit = can(ctx.role, "survey", "edit");
  const canDelete = can(ctx.role, "survey", "delete");
  const editable = survey.status === "DRAFT";

  return (
    <div className="space-y-4">
      <Link href="/app/surveys" className="text-xs text-muted-foreground hover:underline">← Surveys</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{survey.title}</h1>
          {survey.description ? <p className="text-sm text-muted-foreground">{survey.description}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground">{survey.status}</span>
            {" · "}
            <Link href={`/app/surveys/${survey.id}/responses`} className="hover:underline">
              {survey._count.responses} response{survey._count.responses === 1 ? "" : "s"}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && survey.status === "DRAFT" ? (
            <form action={publishSurveyAction.bind(null, survey.id)}>
              <Button type="submit" size="sm">Publish</Button>
            </form>
          ) : null}
          {canEdit && survey.status === "PUBLISHED" ? (
            <form action={closeSurveyAction.bind(null, survey.id)}>
              <Button type="submit" size="sm" variant="outline">Close</Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteSurveyAction.bind(null, survey.id)}>
              <Button type="submit" size="sm" variant="outline">Delete</Button>
            </form>
          ) : null}
        </div>
      </div>

      {survey.status === "PUBLISHED" ? (
        <Card className="p-4">
          <p className="text-sm">Public link:</p>
          <Link href={`/s/${survey.publicSlug}`} target="_blank" className="font-mono text-xs hover:underline">
            /s/{survey.publicSlug}
          </Link>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="border-b bg-muted px-3 py-2 text-sm font-semibold">Questions ({survey.questions.length})</div>
        <ol className="divide-y">
          {survey.questions.map((q) => (
            <li key={q.id} className="flex items-start gap-2 px-3 py-2">
              <span className="mt-0.5 w-6 text-right text-xs text-muted-foreground">{q.position + 1}.</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{q.prompt}{q.required ? <span className="text-red-500">*</span> : null}</div>
                <div className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}{questionUsesRating(q.type) ? ` (1–${q.ratingMax})` : ""}</div>
                {questionUsesOptions(q.type) && Array.isArray(q.options) ? (
                  <ul className="mt-1 ml-3 list-disc text-xs text-muted-foreground">
                    {(q.options as string[]).map((o) => <li key={o}>{o}</li>)}
                  </ul>
                ) : null}
                {q.helpText ? <p className="mt-1 text-xs text-muted-foreground">{q.helpText}</p> : null}
              </div>
              {canEdit && editable ? (
                <div className="flex gap-1">
                  <form action={moveQuestionAction.bind(null, q.id, "up")}>
                    <Button type="submit" size="sm" variant="outline" className="h-6 px-2">↑</Button>
                  </form>
                  <form action={moveQuestionAction.bind(null, q.id, "down")}>
                    <Button type="submit" size="sm" variant="outline" className="h-6 px-2">↓</Button>
                  </form>
                  <form action={deleteQuestionAction.bind(null, q.id)}>
                    <Button type="submit" size="sm" variant="outline" className="h-6 px-2">×</Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
          {survey.questions.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">No questions yet.</li> : null}
        </ol>
      </Card>

      {canEdit && editable ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">Add question</h2>
          <form action={addQuestionAction.bind(null, survey.id)} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="SHORT_TEXT">
                  {QUESTION_TYPES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="ratingMax">Rating max (RATING only)</Label>
                <Input id="ratingMax" name="ratingMax" type="number" min={2} max={10} defaultValue={5} />
              </div>
            </div>
            <div>
              <Label htmlFor="prompt">Prompt</Label>
              <Input id="prompt" name="prompt" required maxLength={500} />
            </div>
            <div>
              <Label htmlFor="helpText">Help text (optional)</Label>
              <Input id="helpText" name="helpText" maxLength={500} />
            </div>
            <div>
              <Label htmlFor="optionsText">Options (one per line; for choice questions)</Label>
              <Textarea id="optionsText" name="optionsText" rows={3} placeholder={"Option A\nOption B\nOption C"} />
            </div>
            <div className="flex items-center gap-2">
              <input id="required" type="checkbox" name="required" />
              <Label htmlFor="required" className="m-0">Required</Label>
            </div>
            <div className="flex justify-end"><Button type="submit">Add question</Button></div>
          </form>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Settings</h2>
          <form action={updateSurveyAction.bind(null, survey.id)} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required defaultValue={survey.title} maxLength={160} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={survey.description ?? ""} />
            </div>
            <div>
              <Label htmlFor="thankYouText">Thank-you message</Label>
              <Textarea id="thankYouText" name="thankYouText" rows={2} maxLength={500} defaultValue={survey.thankYouText ?? ""} />
            </div>
            <div>
              <Label htmlFor="closesAt">Closes at</Label>
              <Input id="closesAt" name="closesAt" type="datetime-local" defaultValue={survey.closesAt ? survey.closesAt.toISOString().slice(0, 16) : ""} />
            </div>
            <div className="flex justify-end"><Button type="submit" variant="outline">Save</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
