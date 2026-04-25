import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APPLICATION_STAGES } from "@/modules/recruit/schemas";
import {
  archiveCandidateAction,
  createApplicationAction,
  updateCandidateAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "view");
  const { id } = await params;
  const [c, openJobs] = await Promise.all([
    prisma.candidate.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        applications: {
          orderBy: { appliedAt: "desc" },
          include: { job: { select: { title: true } } },
        },
      },
    }),
    prisma.jobOpening.findMany({
      where: { workspaceId: ctx.workspaceId, status: { in: ["OPEN", "DRAFT"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
  ]);
  if (!c) notFound();
  const canEdit = can(ctx.role, "candidate", "edit");
  const canApply = can(ctx.role, "application", "create");
  const usedJobIds = new Set(c.applications.map((a) => a.jobId));

  return (
    <div className="space-y-4">
      <Link href="/app/recruit/candidates" className="text-xs text-muted-foreground hover:underline">← Candidates</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{c.firstName} {c.lastName}</h1>
        {c.status === "ARCHIVED" ? <span className="rounded bg-muted px-2 py-0.5 text-xs">Archived</span> : null}
      </div>
      <p className="text-sm text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}{c.location ? ` · ${c.location}` : ""}</p>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit candidate</h2>
          <form action={updateCandidateAction.bind(null, c.id)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required defaultValue={c.firstName} /></div>
              <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required defaultValue={c.lastName} /></div>
              <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required defaultValue={c.email} /></div>
              <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={c.phone ?? ""} /></div>
              <div className="md:col-span-2"><Label htmlFor="headline">Headline</Label><Input id="headline" name="headline" defaultValue={c.headline ?? ""} /></div>
              <div><Label htmlFor="location">Location</Label><Input id="location" name="location" defaultValue={c.location ?? ""} /></div>
              <div><Label htmlFor="source">Source</Label><Input id="source" name="source" defaultValue={c.source ?? ""} /></div>
              <div><Label htmlFor="linkedinUrl">LinkedIn URL</Label><Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={c.linkedinUrl ?? ""} /></div>
              <div><Label htmlFor="resumeUrl">Resume URL</Label><Input id="resumeUrl" name="resumeUrl" type="url" defaultValue={c.resumeUrl ?? ""} /></div>
            </div>
            <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={4} defaultValue={c.notes ?? ""} /></div>
            <div className="flex justify-end gap-2">
              <form action={archiveCandidateAction.bind(null, c.id)}>
                <Button type="submit" variant="outline">{c.status === "ARCHIVED" ? "Restore" : "Archive"}</Button>
              </form>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">Applications ({c.applications.length})</div>
        <table className="w-full text-sm">
          <tbody>
            {c.applications.map((a) => (
              <tr key={a.id} className="border-t hover:bg-accent">
                <td className="px-3 py-2"><Link href={`/app/recruit/applications/${a.id}`} className="hover:underline">{a.job.title}</Link></td>
                <td className="px-3 py-2">{a.stage}</td>
                <td className="px-3 py-2 text-right text-muted-foreground text-xs">{a.appliedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {c.applications.length === 0 ? <tr><td className="px-3 py-4 text-center text-muted-foreground" colSpan={3}>No applications.</td></tr> : null}
          </tbody>
        </table>
      </Card>

      {canApply ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Apply to job</h2>
          {openJobs.filter((j) => !usedJobIds.has(j.id)).length === 0 ? (
            <p className="text-sm text-muted-foreground">Already applied to all open jobs.</p>
          ) : (
            <form action={createApplicationAction} className="grid gap-3 md:grid-cols-3">
              <input type="hidden" name="candidateId" value={c.id} />
              <div className="md:col-span-2">
                <Label htmlFor="jobId">Job</Label>
                <Select id="jobId" name="jobId" required defaultValue="">
                  <option value="">— Pick a job —</option>
                  {openJobs.filter((j) => !usedJobIds.has(j.id)).map((j) => <option key={j.id} value={j.id}>{j.title} ({j.status})</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="stage">Initial stage</Label>
                <Select id="stage" name="stage" defaultValue="APPLIED">
                  {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="md:col-span-3 flex justify-end"><Button type="submit">Add application</Button></div>
            </form>
          )}
        </Card>
      ) : null}
    </div>
  );
}
