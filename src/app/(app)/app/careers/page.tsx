import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  formatEmploymentType,
  formatSalaryRange,
} from "@/modules/recruit/career-schemas";
import { setJobSlugAction, suggestJobSlugAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

export default async function CareerSiteAdminPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "careerSite", "view");
  const canEdit = can(ctx.role, "careerSite", "edit");

  const [workspace, jobs] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { slug: true, name: true },
    }),
    prisma.jobOpening.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        department: true,
        location: true,
        remote: true,
        employment: true,
        status: true,
        salaryMin: true,
        salaryMax: true,
        currency: true,
        _count: { select: { applications: true } },
      },
    }),
  ]);

  const wsSlug = workspace?.slug ?? "";
  const grouped = {
    OPEN: jobs.filter((j) => j.status === "OPEN"),
    DRAFT: jobs.filter((j) => j.status === "DRAFT"),
    ON_HOLD: jobs.filter((j) => j.status === "ON_HOLD"),
    CLOSED: jobs.filter((j) => j.status === "CLOSED"),
  };
  const publicListUrl = `/careers/${wsSlug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Career Site</h1>
          <p className="text-sm text-muted-foreground">
            Publish open positions to a public career page. Each open job with a slug
            becomes applyable from the public site.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/recruit/jobs">
            <Button variant="outline">Manage jobs</Button>
          </Link>
          <Link href={publicListUrl} target="_blank" rel="noreferrer">
            <Button>View public site</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Public URL: </span>
          <code className="rounded bg-muted px-1.5 py-0.5">{publicListUrl}</code>
        </div>
      </Card>

      {(["OPEN", "DRAFT", "ON_HOLD", "CLOSED"] as const).map((status) => {
        const list = grouped[status];
        if (list.length === 0) return null;
        return (
          <section key={status} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {STATUS_LABEL[status]} ({list.length})
            </h2>
            <div className="space-y-3">
              {list.map((job) => {
                const jobUrl = job.slug
                  ? `/careers/${wsSlug}/${job.slug}`
                  : null;
                const isLive = status === "OPEN" && Boolean(job.slug);
                return (
                  <Card key={job.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{job.title}</h3>
                          {isLive ? (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Live
                            </span>
                          ) : null}
                          {job.remote ? (
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Remote
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            job.department,
                            job.location,
                            formatEmploymentType(job.employment),
                            formatSalaryRange(
                              job.salaryMin ? Number(job.salaryMin) : null,
                              job.salaryMax ? Number(job.salaryMax) : null,
                              job.currency,
                            ),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <Link
                          href={`/app/recruit/applications`}
                          className="text-muted-foreground hover:underline"
                        >
                          {job._count.applications} application
                          {job._count.applications === 1 ? "" : "s"}
                        </Link>
                      </div>
                    </div>

                    {canEdit ? (
                      <form
                        action={setJobSlugAction.bind(null, job.id)}
                        className="mt-4 flex flex-wrap items-end gap-2"
                      >
                        <div className="flex-1 min-w-[240px]">
                          <Label htmlFor={`slug-${job.id}`}>Public slug</Label>
                          <Input
                            id={`slug-${job.id}`}
                            name="slug"
                            defaultValue={job.slug ?? ""}
                            placeholder="senior-engineer"
                            pattern="[a-z0-9\-]*"
                            maxLength={160}
                          />
                        </div>
                        <Button type="submit" variant="outline">
                          Save slug
                        </Button>
                        {!job.slug ? (
                          <Button
                            type="submit"
                            variant="ghost"
                            formAction={suggestJobSlugAction.bind(null, job.id)}
                          >
                            Auto-fill from title
                          </Button>
                        ) : null}
                      </form>
                    ) : job.slug ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Slug: <code className="rounded bg-muted px-1.5 py-0.5">{job.slug}</code>
                      </p>
                    ) : null}

                    {jobUrl ? (
                      <p className="mt-2 text-xs">
                        <Link
                          href={jobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {jobUrl}
                        </Link>
                      </p>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}

      {jobs.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No job openings yet.{" "}
          <Link href="/app/recruit/jobs/new" className="text-foreground underline">
            Create one
          </Link>
          .
        </Card>
      ) : null}
    </div>
  );
}
