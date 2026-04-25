import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function FormSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const form = await prisma.form.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
  });
  if (!form) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/app/forms/${id}`} className="text-sm text-muted-foreground hover:underline">← Back to form</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{form.name} — submissions</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {form.submissions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Payload</th>
                </tr>
              </thead>
              <tbody>
                {form.submissions.map((s) => (
                  <tr key={s.id} className="border-b align-top">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                        {JSON.stringify(s.payload, null, 2)}
                      </pre>
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
