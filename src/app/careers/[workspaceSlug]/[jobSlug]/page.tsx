import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  formatEmploymentType,
  formatSalaryRange,
} from "@/modules/recruit/career-schemas";
import { submitApplicationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PublicJobDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; jobSlug: string }>;
}) {
  const { workspaceSlug, jobSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const job = await prisma.jobOpening.findFirst({
    where: {
      workspaceId: workspace.id,
      slug: jobSlug,
      status: "OPEN",
    },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      remote: true,
      employment: true,
      description: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
    },
  });
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="mb-6 text-xs">
        <Link
          href={`/careers/${workspaceSlug}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← All open positions
        </Link>
      </p>

      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {[job.department, job.location, formatEmploymentType(job.employment)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {job.remote ? (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              Remote
            </span>
          ) : null}
          <span className="rounded bg-muted px-2 py-0.5 text-xs">
            {formatSalaryRange(
              job.salaryMin ? Number(job.salaryMin) : null,
              job.salaryMax ? Number(job.salaryMax) : null,
              job.currency,
            )}
          </span>
        </div>
      </header>

      {job.description ? (
        <Card className="mb-8 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            About this role
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {job.description}
          </p>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Apply for this role</h2>
        <form
          action={submitApplicationAction.bind(null, workspaceSlug, jobSlug)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name *</Label>
              <Input id="firstName" name="firstName" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name *</Label>
              <Input id="lastName" name="lastName" required maxLength={120} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" maxLength={40} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="headline">Current title / headline</Label>
              <Input id="headline" name="headline" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" maxLength={160} />
            </div>
          </div>

          <div>
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              maxLength={500}
              placeholder="https://www.linkedin.com/in/…"
            />
          </div>

          <div>
            <Label htmlFor="resumeUrl">Resume URL</Label>
            <Input
              id="resumeUrl"
              name="resumeUrl"
              type="url"
              maxLength={500}
              placeholder="https://…"
            />
          </div>

          <div>
            <Label htmlFor="coverLetter">Cover letter</Label>
            <Textarea
              id="coverLetter"
              name="coverLetter"
              rows={6}
              maxLength={5000}
              placeholder="Tell us why you'd be a great fit…"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Submit application</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
