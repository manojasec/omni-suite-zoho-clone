import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { LifecycleStage } from "@prisma/client";

export const dynamic = "force-dynamic";

const LEAD_STAGES: LifecycleStage[] = [
  LifecycleStage.LEAD,
  LifecycleStage.MQL,
  LifecycleStage.SQL,
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = sp.stage && LEAD_STAGES.includes(sp.stage as LifecycleStage)
    ? (sp.stage as LifecycleStage)
    : undefined;

  const leads = await prisma.contact.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      lifecycleStage: stage ? stage : { in: LEAD_STAGES },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      company: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Contacts in LEAD, MQL, or SQL stage. {leads.length} shown.
          </p>
        </div>
        <Link href="/app/crm/contacts/new">
          <Button><Plus className="h-4 w-4" /> New lead</Button>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by name or email" className="pl-8" />
        </div>
        <div className="flex gap-1">
          <StageFilter current={stage} value={undefined} label="All" />
          {LEAD_STAGES.map((s) => (
            <StageFilter key={s} current={stage} value={s} label={s} />
          ))}
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No leads match this filter.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/crm/contacts/${l.id}`} className="font-medium hover:underline">
                        {l.firstName} {l.lastName ?? ""}
                      </Link>
                      <div className="text-xs text-muted-foreground">{l.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{l.company?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {l.lifecycleStage}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{l.source ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {l.owner ? (l.owner.name ?? l.owner.email) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StageFilter({
  current,
  value,
  label,
}: {
  current?: LifecycleStage;
  value?: LifecycleStage;
  label: string;
}) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value) params.set("stage", value);
  return (
    <Link
      href={`/app/crm/leads${params.toString() ? `?${params}` : ""}`}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}
