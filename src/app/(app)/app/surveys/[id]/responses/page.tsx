import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { BarList, StatCard } from "@/components/analytics/charts";
import { QUESTION_TYPE_LABELS, summarizeAnswers } from "@/modules/surveys/schemas";

export const dynamic = "force-dynamic";

export default async function SurveyResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "surveyResponse", "view");
  const { id } = await params;
  const survey = await prisma.survey.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      questions: { orderBy: { position: "asc" }, include: { answers: true } },
      responses: { orderBy: { submittedAt: "desc" }, take: 100, include: { answers: true } },
    },
  });
  if (!survey) notFound();
  const totalResponses = await prisma.surveyResponse.count({ where: { surveyId: id } });

  return (
    <div className="space-y-4">
      <Link href={`/app/surveys/${survey.id}`} className="text-xs text-muted-foreground hover:underline">← {survey.title}</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Responses</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard title="Total responses" value={totalResponses} />
        <StatCard title="Questions" value={survey.questions.length} />
        <StatCard title="Status" value={survey.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {survey.questions.map((q) => {
          const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
          const summary = summarizeAnswers(
            { type: q.type, options: opts, ratingMax: q.ratingMax },
            q.answers.map((a) => ({ text: a.text, number: a.number, choices: a.choices })),
          );
          if (summary.buckets) {
            return (
              <BarList
                key={q.id}
                title={q.prompt}
                series={summary.buckets.map((b) => ({ label: b.label, value: b.count }))}
                emptyHint={`${QUESTION_TYPE_LABELS[q.type]} · no answers yet`}
              />
            );
          }
          if (summary.numbers) {
            const n = summary.numbers;
            return (
              <Card key={q.id} className="p-4">
                <h3 className="text-sm font-semibold">{q.prompt}</h3>
                <p className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]}</p>
                {n.count === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No answers yet.</p>
                ) : (
                  <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                    <div><dt className="text-xs text-muted-foreground">Avg</dt><dd className="text-lg font-semibold">{n.avg.toFixed(2)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Min</dt><dd className="text-lg font-semibold">{n.min}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Max</dt><dd className="text-lg font-semibold">{n.max}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Count</dt><dd className="text-lg font-semibold">{n.count}</dd></div>
                  </dl>
                )}
              </Card>
            );
          }
          // text/email — show recent answers
          const recent = q.answers.filter((a) => a.text).slice(-5).reverse();
          return (
            <Card key={q.id} className="p-4">
              <h3 className="text-sm font-semibold">{q.prompt}</h3>
              <p className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[q.type]} · {summary.total} answer{summary.total === 1 ? "" : "s"}</p>
              {recent.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No answers yet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {recent.map((a) => <li key={a.id} className="rounded border px-2 py-1 text-xs">{a.text}</li>)}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="border-b bg-muted px-3 py-2 text-sm font-semibold">Recent responses</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1 text-left">Submitted</th>
              <th className="px-3 py-1 text-left">Respondent</th>
              <th className="px-3 py-1 text-right">Answers</th>
            </tr>
          </thead>
          <tbody>
            {survey.responses.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-1.5 text-muted-foreground">{r.submittedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-1.5">{r.respondent ?? <span className="text-muted-foreground italic">anonymous</span>}</td>
                <td className="px-3 py-1.5 text-right">{r.answers.length}</td>
              </tr>
            ))}
            {survey.responses.length === 0 ? <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No responses yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
