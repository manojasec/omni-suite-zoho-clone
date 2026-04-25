import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  const { status } = await searchParams;
  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && status !== "ALL" ? { status: status as "PLANNING" } : {}),
  };
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <Link
          href="/app/projects/new"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New project
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const active = (s === "ALL" && !status) || s === status;
          const href = s === "ALL" ? "/app/projects" : `/app/projects?status=${s}`;
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
          {projects.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Timeline</th>
                  <th className="px-3 py-2 text-right">Tasks</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link href={`/app/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{p.status}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString() : "—"}
                      {" → "}
                      {p.endDate ? new Date(p.endDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p._count.tasks}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
                      {p.budgetAmount ? Number(p.budgetAmount).toLocaleString() : p.budgetHours ? `${p.budgetHours}h` : "—"}
                    </td>
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
