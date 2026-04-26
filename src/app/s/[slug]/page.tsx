import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPE_LABELS } from "@/modules/surveys/schemas";
import { submitSurveyResponseAction } from "@/app/(app)/app/surveys/actions";

export const dynamic = "force-dynamic";

export default async function PublicSurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const survey = await prisma.survey.findUnique({
    where: { publicSlug: slug },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!survey) notFound();

  const isClosed = survey.status !== "PUBLISHED" || (survey.closesAt && survey.closesAt.getTime() < Date.now());

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{survey.title}</h1>
        {survey.description ? <p className="mt-2 text-sm text-muted-foreground">{survey.description}</p> : null}
      </div>

      {isClosed ? (
        <Card className="p-6 text-center">
          <p className="text-sm">This survey is not currently accepting responses.</p>
        </Card>
      ) : (
        <Card className="p-6">
          <form action={submitSurveyResponseAction.bind(null, slug)} className="space-y-5">
            <div>
              <Label htmlFor="respondent">Your name (optional)</Label>
              <Input id="respondent" name="respondent" maxLength={160} />
            </div>

            {survey.questions.map((q) => {
              const fieldName = `q_${q.id}`;
              const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
              return (
                <div key={q.id} className="space-y-1.5">
                  <Label className="text-base">
                    {q.prompt}{q.required ? <span className="text-red-500">*</span> : null}
                  </Label>
                  {q.helpText ? <p className="text-xs text-muted-foreground">{q.helpText}</p> : null}
                  {q.type === "SHORT_TEXT" ? (
                    <Input name={fieldName} required={q.required} maxLength={500} />
                  ) : null}
                  {q.type === "LONG_TEXT" ? (
                    <Textarea name={fieldName} required={q.required} rows={4} maxLength={4000} />
                  ) : null}
                  {q.type === "EMAIL" ? (
                    <Input name={fieldName} type="email" required={q.required} maxLength={500} />
                  ) : null}
                  {q.type === "NUMBER" ? (
                    <Input name={fieldName} type="number" step="any" required={q.required} />
                  ) : null}
                  {q.type === "RATING" ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: q.ratingMax }, (_, i) => i + 1).map((n) => (
                        <label key={n} className="flex cursor-pointer items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-muted">
                          <input type="radio" name={fieldName} value={n} required={q.required} />
                          {n}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {q.type === "SINGLE_CHOICE" ? (
                    <div className="space-y-1">
                      {opts.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input type="radio" name={fieldName} value={o} required={q.required} />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {q.type === "MULTI_CHOICE" ? (
                    <div className="space-y-1">
                      {opts.map((o) => (
                        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input type="checkbox" name={fieldName} value={o} />
                          {o}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}</p>
                </div>
              );
            })}

            <Button type="submit" className="w-full">Submit response</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
