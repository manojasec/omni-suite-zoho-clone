import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EMAIL_TEMPLATE_CATEGORIES } from "@/modules/email-templates/schemas";
import { createEmailTemplateAction } from "../actions";

export default async function NewEmailTemplatePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "create");

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        New email template
      </h1>
      <Card className="p-4">
        <form action={createEmailTemplateAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                name="category"
                required
                defaultValue="transactional"
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
            <Input id="subject" name="subject" required maxLength={200} />
          </div>
          <div>
            <Label htmlFor="bodyText">
              Body (text — supports{" "}
              <code className="text-xs">{"{{variables}}"}</code>)
            </Label>
            <Textarea
              id="bodyText"
              name="bodyText"
              rows={8}
              required
              maxLength={20000}
            />
          </div>
          <div>
            <Label htmlFor="bodyHtml">Body (HTML, optional)</Label>
            <Textarea
              id="bodyHtml"
              name="bodyHtml"
              rows={6}
              maxLength={50000}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              name="isActive"
              type="checkbox"
              defaultChecked
              className="h-4 w-4"
            />
            <Label htmlFor="isActive">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Create</Button>
            <Link href="/app/email-templates">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
