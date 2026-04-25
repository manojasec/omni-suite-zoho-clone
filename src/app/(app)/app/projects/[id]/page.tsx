import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/platform/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectForm } from "../project-form";
import { updateProjectAction, deleteProjectAction } from "../actions";
import { TaskBoard, type TaskCard } from "./task-board";
import { NewTaskInline } from "./new-task-inline";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();

  const [project, members] = await Promise.all([
    prisma.project.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        tasks: {
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          include: { assignee: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  if (!project) notFound();

  const update = updateProjectAction.bind(null, id);
  const remove = deleteProjectAction.bind(null, id);
  const canEditTasks = can(ctx.role, "task", "edit");
  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
  }));

  const taskCards: TaskCard[] = project.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    assigneeName: t.assignee ? (t.assignee.name ?? t.assignee.email) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/projects" className="text-sm text-muted-foreground hover:underline">
            ← All projects
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.status}
            {project.startDate ? ` · starts ${new Date(project.startDate).toLocaleDateString()}` : ""}
            {project.endDate ? ` · ends ${new Date(project.endDate).toLocaleDateString()}` : ""}
          </p>
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Task board</span>
                {canEditTasks ? <NewTaskInline projectId={project.id} members={memberOptions} /> : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskBoard initialTasks={taskCards} canEdit={canEditTasks} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle>Edit project</CardTitle></CardHeader>
            <CardContent>
              <ProjectForm
                action={update}
                submitLabel="Save changes"
                initial={{
                  name: project.name,
                  description: project.description,
                  status: project.status,
                  startDate: project.startDate ? project.startDate.toISOString() : null,
                  endDate: project.endDate ? project.endDate.toISOString() : null,
                  budgetHours: project.budgetHours,
                  budgetAmount: project.budgetAmount ? project.budgetAmount.toString() : null,
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
