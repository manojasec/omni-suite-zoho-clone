import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ENROLLMENT_STATUS_LABELS,
  formatDuration,
  progressPercent,
} from "@/modules/learn/schemas";
import {
  clearLessonCompletionAction,
  markLessonCompleteAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function LearnerProgressPage({
  params,
}: {
  params: Promise<{ id: string; enrollmentId: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "courseEnrollment", "view");
  const { id, enrollmentId } = await params;

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, courseId: id, course: { workspaceId: ctx.workspaceId } },
    include: {
      course: {
        include: { lessons: { orderBy: { position: "asc" } } },
      },
      progress: { select: { lessonId: true, completedAt: true } },
    },
  });
  if (!enrollment) notFound();

  const completedSet = new Set(enrollment.progress.map((p) => p.lessonId));
  const totalLessons = enrollment.course.lessons.length;
  const pct = progressPercent(completedSet.size, totalLessons);
  const canEdit = can(ctx.role, "courseEnrollment", "edit");

  const mark = markLessonCompleteAction.bind(null, enrollment.id);
  const clear = clearLessonCompletionAction.bind(null, enrollment.id);

  return (
    <div className="space-y-3">
      <div>
        <Link
          href={`/app/learn/${enrollment.course.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to {enrollment.course.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{enrollment.learnerName}</h1>
        <p className="text-sm text-muted-foreground">{enrollment.learnerEmail}</p>
      </div>

      <Card className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {ENROLLMENT_STATUS_LABELS[enrollment.status]} · {pct}%
            </p>
            <p className="text-xs text-muted-foreground">
              {completedSet.size} of {totalLessons} lessons complete
            </p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <Card className="divide-y">
        {enrollment.course.lessons.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">This course has no lessons yet.</p>
        ) : (
          enrollment.course.lessons.map((l, idx) => {
            const done = completedSet.has(l.id);
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {idx + 1}. {l.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(l.durationMinutes)}
                    {done ? " · ✓ completed" : ""}
                  </p>
                </div>
                {canEdit ? (
                  done ? (
                    <form action={clear}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      <Button type="submit" size="sm" variant="outline">
                        Mark incomplete
                      </Button>
                    </form>
                  ) : (
                    <form action={mark}>
                      <input type="hidden" name="lessonId" value={l.id} />
                      <Button type="submit" size="sm">
                        Mark complete
                      </Button>
                    </form>
                  )
                ) : null}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
