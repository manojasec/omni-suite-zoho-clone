import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  formatEmploymentType,
  formatSalaryRange,
} from "@/modules/recruit/career-schemas";

export const dynamic = "force-dynamic";

export default async function PublicCareersListPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const jobs = await prisma.jobOpening.findMany({
    where: {
      workspaceId: workspace.id,
      status: "OPEN",
      slug: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      department: true,
      location: true,
      remote: true,
      employment: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name} careers
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Open positions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join our team. Browse open roles below and apply directly.
        </p>
      </header>

      {jobs.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No open positions right now. Check back soon.
        </Card>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/careers/${workspaceSlug}/${job.slug}`}
                className="block"
              >
                <Card className="p-4 transition hover:border-foreground/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{job.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          job.department,
                          job.location,
                          formatEmploymentType(job.employment),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {job.remote ? (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Remote
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatSalaryRange(
                          job.salaryMin ? Number(job.salaryMin) : null,
                          job.salaryMax ? Number(job.salaryMax) : null,
                          job.currency,
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
