import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudienceForm } from "../audience-form";
import { updateAudienceAction, deleteAudienceAction } from "../../actions";
import { compileAudienceWhere } from "@/modules/marketing/audience";

type DSL = { stage?: string[]; tag?: string[]; hasEmail?: boolean };

export default async function AudienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const audience = await prisma.audience.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!audience) notFound();

  const dsl = (audience.filterDsl as DSL) ?? {};
  const where = compileAudienceWhere(ctx.workspaceId, dsl as Parameters<typeof compileAudienceWhere>[1]);
  const [count, sample] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, firstName: true, lastName: true, email: true, lifecycleStage: true },
    }),
  ]);

  const update = updateAudienceAction.bind(null, id);
  const remove = deleteAudienceAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/campaigns" className="text-sm text-muted-foreground hover:underline">← All campaigns</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{audience.name}</h1>
        <p className="text-sm text-muted-foreground">{count} contact{count === 1 ? "" : "s"} match this audience.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Edit audience</CardTitle></CardHeader>
          <CardContent>
            <AudienceForm
              action={update}
              submitLabel="Save changes"
              initial={{
                name: audience.name,
                stage: dsl.stage ?? [],
                tags: dsl.tag ?? [],
                hasEmail: dsl.hasEmail ?? false,
              }}
            />
            <form action={remove} className="mt-3 border-t pt-3">
              <Button type="submit" variant="destructive" size="sm">Delete audience</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sample contacts</CardTitle></CardHeader>
          <CardContent>
            {sample.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching contacts.</p>
            ) : (
              <ul className="divide-y text-sm">
                {sample.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span>
                      {c.firstName} {c.lastName}
                      {c.email ? <span className="ml-2 text-xs text-muted-foreground">{c.email}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.lifecycleStage}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
