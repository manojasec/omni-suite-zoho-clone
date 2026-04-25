import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const customers = await prisma.customer.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      company: { select: { name: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} shown</p>
        </div>
        <Link href="/app/billing/customers/new">
          <Button><Plus className="h-4 w-4" /> New customer</Button>
        </Link>
      </div>

      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Search by name or email" className="pl-8" />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Currency</th>
                <th className="px-4 py-2 text-right">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No customers yet. <Link href="/app/billing/customers/new" className="underline">Add your first.</Link>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/billing/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.company?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.currency}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c._count.invoices}</td>
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
