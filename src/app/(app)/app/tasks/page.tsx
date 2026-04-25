import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; scope?: string }>;
}) {
  const ctx = await requireSession();
  const { status, scope } = await searchParams;
  const onlyMine = scope !== "all";

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(onlyMine ? { assigneeId: ctx.userId } : {}),
      ...(status && status !== "ALL" ? { status: status as "TODO" } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{onlyMine ? "My tasks" : "All tasks"}</h1>
        <div className="flex gap-2">
          <Link
            href={onlyMine ? "/app/tasks?scope=all" : "/app/tasks"}
            className="text-xs underline-offset-2 hover:underline"
          >
            {onlyMine ? "Show all tasks" : "Show only mine"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const active = (s === "ALL" && !status) || s === status;
          const params = new URLSearchParams();
          if (s !== "ALL") params.set("status", s);
          if (!onlyMine) params.set("scope", "all");
          const href = params.toString() ? `/app/tasks?${params}` : "/app/tasks";
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-secondary" : "hover:bg-accent"}`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No tasks.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Project</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Assignee</th>
                  <th className="px-3 py-2 text-left">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-accent/40">
                    <td className="px-3 py-2 font-medium">{t.title}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.project ? (
                        <Link href={`/app/projects/${t.project.id}`} className="hover:underline">{t.project.name}</Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">{t.status}</td>
                    <td className="px-3 py-2 text-xs">{t.priority}</td>
                    <td className="px-3 py-2 text-xs">{t.assignee ? (t.assignee.name ?? t.assignee.email) : "—"}</td>
                    <td className="px-3 py-2 text-xs">{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
