import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const ctx = await requireSession();
  const forms = await prisma.form.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <Link
          href="/app/forms/new"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New form
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {forms.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No forms yet. Create one to start collecting submissions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Destination</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Submissions</th>
                  <th className="px-3 py-2 text-left">Public link</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} className="border-b hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link href={`/app/forms/${f.id}`} className="font-medium hover:underline">
                        {f.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">{f.destination}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          f.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {f.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{f._count.submissions}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <Link href={`/forms/${f.publicId}`} className="hover:underline" target="_blank">
                        /forms/{f.publicId.slice(0, 8)}…
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
