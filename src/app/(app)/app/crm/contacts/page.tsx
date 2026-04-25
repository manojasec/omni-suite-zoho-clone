import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = sp.stage;

  const contacts = await prisma.contact.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(stage ? { lifecycleStage: stage as any } : {}),
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
    include: { company: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} shown</p>
        </div>
        <Link href="/app/crm/contacts/new">
          <Button><Plus className="h-4 w-4" /> New contact</Button>
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
                <th className="px-4 py-2 text-left">Stage</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No contacts yet. <Link href="/app/crm/contacts/new" className="underline">Add your first.</Link>
                  </td>
                </tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <Link href={`/app/crm/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.firstName} {c.lastName ?? ""}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.company?.name ?? "—"}</td>
                    <td className="px-4 py-2"><StageBadge stage={c.lifecycleStage} /></td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
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

function StageBadge({ stage }: { stage: string }) {
  const styles: Record<string, string> = {
    LEAD: "bg-blue-100 text-blue-800",
    MQL: "bg-indigo-100 text-indigo-800",
    SQL: "bg-purple-100 text-purple-800",
    CUSTOMER: "bg-green-100 text-green-800",
    CHURNED: "bg-zinc-200 text-zinc-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[stage] ?? ""}`}>
      {stage}
    </span>
  );
}
