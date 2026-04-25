import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "@/modules/recruit/schemas";
import { deleteJobAction, updateJobAction } from "../../actions";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "view");
  const { id } = await params;
  const job = await prisma.jobOpening.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      applications: {
        orderBy: { appliedAt: "desc" },
        include: { candidate: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
  });
  if (!job) notFound();
  const canEdit = can(ctx.role, "jobOpening", "edit");
  const canDelete = can(ctx.role, "jobOpening", "delete");

  return (
    <div className="space-y-4">
      <Link href="/app/recruit/jobs" className="text-xs text-muted-foreground hover:underline">← Job openings</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">{job.status}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {job.department ?? "—"} · {job.location ?? "—"}{job.remote ? " · Remote" : ""} · {job.employment.replace("_", " ")}
        {job.salaryMin || job.salaryMax ? ` · ${formatCurrency(Number(job.salaryMin ?? 0), job.currency)} – ${formatCurrency(Number(job.salaryMax ?? 0), job.currency)}` : ""}
      </p>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit job</h2>
          <form action={updateJobAction.bind(null, job.id)} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={120} defaultValue={job.title} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" maxLength={80} defaultValue={job.department ?? ""} />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" maxLength={120} defaultValue={job.location ?? ""} />
              </div>
              <div>
                <Label htmlFor="employment">Employment type</Label>
                <Select id="employment" name="employment" defaultValue={job.employment}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={job.status}>
                  {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="remote" name="remote" defaultChecked={job.remote} />
                <Label htmlFor="remote">Remote-friendly</Label>
              </div>
              <div>
                <Label htmlFor="openings">Number of openings</Label>
                <Input id="openings" name="openings" type="number" min={1} defaultValue={job.openings} />
              </div>
              <div>
                <Label htmlFor="salaryMin">Salary min</Label>
                <Input id="salaryMin" name="salaryMin" type="number" step="0.01" min={0} defaultValue={job.salaryMin ? Number(job.salaryMin) : ""} />
              </div>
              <div>
                <Label htmlFor="salaryMax">Salary max</Label>
                <Input id="salaryMax" name="salaryMax" type="number" step="0.01" min={0} defaultValue={job.salaryMax ? Number(job.salaryMax) : ""} />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" maxLength={3} defaultValue={job.currency} />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={6} maxLength={8000} defaultValue={job.description ?? ""} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-6 whitespace-pre-wrap text-sm">{job.description}</Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">Applications ({job.applications.length})</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-1 text-left">Candidate</th><th className="px-3 py-1 text-left">Stage</th><th className="px-3 py-1 text-left">Applied</th></tr>
          </thead>
          <tbody>
            {job.applications.map((a) => (
              <tr key={a.id} className="border-t hover:bg-accent">
                <td className="px-3 py-2"><Link href={`/app/recruit/applications/${a.id}`} className="hover:underline">{a.candidate.firstName} {a.candidate.lastName}</Link><div className="text-xs text-muted-foreground">{a.candidate.email}</div></td>
                <td className="px-3 py-2">{a.stage}</td>
                <td className="px-3 py-2 text-muted-foreground">{a.appliedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {job.applications.length === 0 ? <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No applications.</td></tr> : null}
          </tbody>
        </table>
      </Card>

      {canDelete ? (
        <form action={deleteJobAction.bind(null, job.id)}>
          <Button type="submit" variant="destructive">Delete job</Button>
        </form>
      ) : null}
    </div>
  );
}
