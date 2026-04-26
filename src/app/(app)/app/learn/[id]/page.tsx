import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  COURSE_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  formatDuration,
  progressPercent,
  totalDurationMinutes,
} from "@/modules/learn/schemas";
import {
  addLessonAction,
  archiveCourseAction,
  deleteCourseAction,
  deleteLessonAction,
  enrollLearnerAction,
  publishCourseAction,
  reorderLessonAction,
  unenrollLearnerAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "view");
  const { id } = await params;

  const course = await prisma.course.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      lessons: { orderBy: { position: "asc" } },
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: { _count: { select: { progress: true } } },
      },
    },
  });
  if (!course) notFound();

  const totalLessons = course.lessons.length;
  const totalMinutes = totalDurationMinutes(course.lessons);
  const canEdit = can(ctx.role, "course", "edit");
  const canDelete = can(ctx.role, "course", "delete");
  const canCreateLesson = can(ctx.role, "lesson", "create");
  const canEditLesson = can(ctx.role, "lesson", "edit");
  const canDeleteLesson = can(ctx.role, "lesson", "delete");
  const canEnroll = can(ctx.role, "courseEnrollment", "create");
  const canDeleteEnrollment = can(ctx.role, "courseEnrollment", "delete");

  const publish = publishCourseAction.bind(null, course.id);
  const archive = archiveCourseAction.bind(null, course.id);
  const del = deleteCourseAction.bind(null, course.id);
  const addLesson = addLessonAction.bind(null, course.id);
  const enroll = enrollLearnerAction.bind(null, course.id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {COURSE_STATUS_LABELS[course.status]} · /{course.slug}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
          {course.summary ? (
            <p className="text-sm text-muted-foreground">{course.summary}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {totalLessons} lessons · {formatDuration(totalMinutes)} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && course.status !== "PUBLISHED" ? (
            <form action={publish}>
              <Button type="submit">Publish</Button>
            </form>
          ) : null}
          {canEdit && course.status !== "ARCHIVED" ? (
            <form action={archive}>
              <Button type="submit" variant="outline">
                Archive
              </Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={del}>
              <Button type="submit" variant="outline" className="text-rose-600">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {course.description ? (
        <Card className="p-4">
          <h2 className="text-sm font-medium">Description</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {course.description}
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium">Lessons</h2>
          {course.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No lessons yet — add the first lesson below.
            </p>
          ) : (
            <ol className="space-y-2">
              {course.lessons.map((l, idx) => {
                const reorder = reorderLessonAction.bind(null, l.id);
                const removeLesson = deleteLessonAction.bind(null, l.id);
                return (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {idx + 1}. {l.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuration(l.durationMinutes)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {canEditLesson ? (
                        <>
                          <form action={reorder}>
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={idx === 0}
                            >
                              ↑
                            </Button>
                          </form>
                          <form action={reorder}>
                            <input type="hidden" name="direction" value="down" />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={idx === course.lessons.length - 1}
                            >
                              ↓
                            </Button>
                          </form>
                        </>
                      ) : null}
                      {canDeleteLesson ? (
                        <form action={removeLesson}>
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="text-rose-600"
                          >
                            Remove
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {canCreateLesson ? (
            <form action={addLesson} className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Add lesson</p>
              <div className="space-y-1">
                <Label htmlFor="lesson-title">Title</Label>
                <Input
                  id="lesson-title"
                  name="title"
                  required
                  maxLength={200}
                  placeholder="Lesson title"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lesson-duration">Duration (minutes)</Label>
                <Input
                  id="lesson-duration"
                  name="durationMinutes"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={10}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lesson-content">Content</Label>
                <Textarea id="lesson-content" name="content" rows={4} placeholder="Lesson body…" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add lesson
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-medium">Learners</h2>
          {course.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No learners enrolled yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {course.enrollments.map((e) => {
                const removeEnroll = unenrollLearnerAction.bind(null, e.id);
                const pct = progressPercent(e._count.progress, totalLessons);
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/learn/${course.id}/learners/${e.id}`}
                        className="font-medium hover:underline"
                      >
                        {e.learnerName}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{e.learnerEmail}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {pct}% · {ENROLLMENT_STATUS_LABELS[e.status]}
                        </span>
                      </div>
                    </div>
                    {canDeleteEnrollment ? (
                      <form action={removeEnroll}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="text-rose-600"
                        >
                          Unenroll
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {canEnroll ? (
            <form action={enroll} className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Enroll learner</p>
              <div className="space-y-1">
                <Label htmlFor="learner-name">Name</Label>
                <Input
                  id="learner-name"
                  name="learnerName"
                  required
                  maxLength={160}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="learner-email">Email</Label>
                <Input
                  id="learner-email"
                  name="learnerEmail"
                  type="email"
                  required
                  maxLength={200}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Enroll
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
