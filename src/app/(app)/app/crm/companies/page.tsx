import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const companies = await prisma.company.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { domain: { contains: q } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { contacts: true, deals: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">{companies.length} shown</p>
        </div>
        <Link href="/app/crm/companies/new">
          <Button><Plus className="h-4 w-4" /> New company</Button>
        </Link>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by name or domain" className="pl-8" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Domain</th>
                <th className="px-4 py-2 text-left">Industry</th>
                <th className="px-4 py-2 text-right">Contacts</th>
                <th className="px-4 py-2 text-right">Deals</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No companies yet.{" "}
                    <Link href="/app/crm/companies/new" className="underline">
                      Add your first.
                    </Link>
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/crm/companies/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.domain ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.industry ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c._count.contacts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c._count.deals}</td>
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
