import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormBuilder, FormPreview } from "../form-builder";
import { updateFormAction, deleteFormAction } from "../actions";
import type { FieldDef } from "@/modules/forms/schemas";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const form = await prisma.form.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { _count: { select: { submissions: true } } },
  });
  if (!form) notFound();

  const fields = ((form.schema as { fields?: FieldDef[] })?.fields ?? []) as FieldDef[];
  const update = updateFormAction.bind(null, id);
  const remove = deleteFormAction.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/forms" className="text-sm text-muted-foreground hover:underline">← All forms</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{form.name}</h1>
          <p className="text-sm text-muted-foreground">
            {form.isPublished ? "Published" : "Draft"} · {form.destination} · {form._count.submissions} submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/app/forms/${id}/submissions`}
            className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            View submissions
          </Link>
          <form action={remove}>
            <Button type="submit" variant="destructive" size="sm">Delete</Button>
          </form>
        </div>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <span className="text-muted-foreground">Public URL: </span>
        <Link href={`/forms/${form.publicId}`} target="_blank" className="font-mono hover:underline">
          /forms/{form.publicId}
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader><CardTitle>Edit form</CardTitle></CardHeader>
          <CardContent>
            <FormBuilder
              action={update}
              submitLabel="Save changes"
              initial={{
                name: form.name,
                destination: form.destination as "submission",
                isPublished: form.isPublished,
                fields,
              }}
            />
          </CardContent>
        </Card>
        <FormPreview fields={fields} />
      </div>
    </div>
  );
}
