import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FieldDef } from "@/modules/forms/schemas";
import { PublicFormView } from "./public-form-view";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const form = await prisma.form.findUnique({
    where: { publicId },
    select: { name: true, isPublished: true, schema: true, publicId: true },
  });
  if (!form || !form.isPublished) notFound();

  const fields = ((form.schema as { fields?: FieldDef[] })?.fields ?? []) as FieldDef[];

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <PublicFormView publicId={form.publicId} name={form.name} fields={fields} />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Powered by OmniSuite</p>
    </main>
  );
}
