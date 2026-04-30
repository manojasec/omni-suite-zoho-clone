import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  extractTemplateVariables,
  renderEmailTemplate,
} from "@/modules/email-templates/schemas";
import {
  deleteEmailTemplateAction,
  updateEmailTemplateAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EmailTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "view");
  const canEdit = can(ctx.role, "emailTemplate", "edit");
  const canDelete = can(ctx.role, "emailTemplate", "delete");
  const { id } = await params;

  const t = await prisma.emailTemplate.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!t) notFound();

  const variables = [
    ...new Set([
      ...extractTemplateVariables(t.subject),
      ...extractTemplateVariables(t.bodyText),
      ...extractTemplateVariables(t.bodyHtml ?? ""),
    ]),
  ];
  const sample: Record<string, string> = Object.fromEntries(
    variables.map((v) => [v, `<${v}>`]),
  );
  const previewSubject = renderEmailTemplate(t.subject, sample);
  const previewBody = renderEmailTemplate(t.bodyText, sample);

  const update = updateEmailTemplateAction.bind(null, t.id);
  const del = deleteEmailTemplateAction.bind(null, t.id);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.name}</h1>
        <Card className="p-4">
          <form action={update} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={t.name}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  name="category"
                  required
                  defaultValue={t.category}
                  disabled={!canEdit}
                >
                  {EMAIL_TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                name="subject"
                required
                maxLength={200}
                defaultValue={t.subject}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="bodyText">Body (text)</Label>
              <Textarea
                id="bodyText"
                name="bodyText"
                rows={10}
                required
                maxLength={20000}
                defaultValue={t.bodyText}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="bodyHtml">Body (HTML)</Label>
              <Textarea
                id="bodyHtml"
                name="bodyHtml"
                rows={6}
                maxLength={50000}
                defaultValue={t.bodyHtml ?? ""}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked={t.isActive}
                disabled={!canEdit}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
            {canEdit ? (
              <div>
                <Button type="submit">Save changes</Button>
              </div>
            ) : null}
          </form>
        </Card>

        {canDelete ? (
          <form action={del}>
            <Button type="submit" size="sm" variant="ghost">
              Delete template
            </Button>
          </form>
        ) : null}

        <div>
          <Link
            href="/app/email-templates"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to templates
          </Link>
        </div>
      </div>

      <Card className="space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Preview</h2>
        <div>
          <Label>Variables detected</Label>
          {variables.length === 0 ? (
            <p className="text-xs text-muted-foreground">None</p>
          ) : (
            <ul className="flex flex-wrap gap-1 text-xs">
              {variables.map((v) => (
                <li key={v} className="rounded bg-muted px-2 py-0.5 font-mono">
                  {v}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <Label>Subject</Label>
          <div className="rounded border bg-background p-2 text-sm">
            {previewSubject}
          </div>
        </div>
        <div>
          <Label>Body</Label>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-xs">
            {previewBody}
          </pre>
        </div>
      </Card>
    </div>
  );
}
