import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { COURSE_STATUS_LABELS } from "@/modules/learn/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-amber-100 text-amber-700",
};

export default async function LearnListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "course", "view");

  const courses = await prisma.course.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { lessons: true, enrollments: true } },
    },
  });
  const canCreate = can(ctx.role, "course", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
          <p className="text-sm text-muted-foreground">
            Author courses, organize lessons, and track learner progress.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/learn/new">
            <Button>New course</Button>
          </Link>
        ) : null}
      </div>

      {courses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No courses yet — create your first course to start building lessons.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              {c.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverImageUrl} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="h-32 bg-gradient-to-br from-indigo-50 to-violet-100" />
              )}
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/app/learn/${c.id}`}
                    className="font-medium leading-tight hover:underline"
                  >
                    {c.title}
                  </Link>
                  <span
                    className={
                      "shrink-0 rounded px-2 py-0.5 text-xs font-medium " +
                      (statusColor[c.status] ?? "bg-zinc-100 text-zinc-700")
                    }
                  >
                    {COURSE_STATUS_LABELS[c.status]}
                  </span>
                </div>
                {c.summary ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  /{c.slug} · {c._count.lessons} lessons · {c._count.enrollments} learners
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
