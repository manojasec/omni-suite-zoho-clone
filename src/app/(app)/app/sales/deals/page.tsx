import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { DealStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALL_STATUSES: DealStatus[] = [DealStatus.OPEN, DealStatus.WON, DealStatus.LOST];

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status && ALL_STATUSES.includes(sp.status as DealStatus)
    ? (sp.status as DealStatus)
    : undefined;

  const deals = await prisma.deal.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q } } : {}),
    },
    include: {
      stage: { select: { name: true } },
      pipeline: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      contact: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const totals = {
    open: deals.filter((d) => d.status === "OPEN").reduce((a, d) => a + Number(d.value), 0),
    won: deals.filter((d) => d.status === "WON").reduce((a, d) => a + Number(d.value), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted-foreground">
            {deals.length} shown · open {totals.open.toLocaleString(undefined, { maximumFractionDigits: 0 })} · won {totals.won.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <Link href="/app/sales/deals/new">
          <Button><Plus className="h-4 w-4" /> New deal</Button>
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search deal name" className="pl-8" />
        </div>
        <div className="flex gap-1">
          <FilterChip current={status} value={undefined} label="All" />
          {ALL_STATUSES.map((s) => (
            <FilterChip key={s} current={status} value={s} label={s} />
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
                <th className="px-4 py-2 text-right">Value</th>
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Close date</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No deals match this filter.
                  </td>
                </tr>
              ) : (
                deals.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/sales/deals/${d.id}`} className="font-medium hover:underline">
                        {d.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{d.pipeline.name}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {Number(d.value).toLocaleString()} {d.currency}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{d.stage.name}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        d.status === "WON" ? "bg-green-100 text-green-900" :
                        d.status === "LOST" ? "bg-red-100 text-red-900" :
                        "bg-secondary"
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.contact ? `${d.contact.firstName} ${d.contact.lastName ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.owner ? d.owner.name ?? d.owner.email : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {d.expectedCloseAt ? new Date(d.expectedCloseAt).toLocaleDateString() : "—"}
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

function FilterChip({
  current, value, label,
}: { current?: DealStatus; value?: DealStatus; label: string }) {
  const active = current === value;
  const params = new URLSearchParams();
  if (value) params.set("status", value);
  return (
    <Link
      href={`/app/sales/deals${params.toString() ? `?${params}` : ""}`}
      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}
