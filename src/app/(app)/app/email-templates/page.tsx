import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  formatEmailCategory,
} from "@/modules/email-templates/schemas";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "emailTemplate", "view");
  const canCreate = can(ctx.role, "emailTemplate", "create");

  const templates = await prisma.emailTemplate.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const grouped = new Map<string, typeof templates>();
  for (const cat of EMAIL_TEMPLATE_CATEGORIES) grouped.set(cat, []);
  for (const t of templates) {
    const cat = grouped.has(t.category) ? t.category : "other";
    grouped.get(cat)!.push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Email templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Reusable email content for transactional and marketing messages.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/email-templates/new">
            <Button>New template</Button>
          </Link>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No templates yet.
        </Card>
      ) : (
        EMAIL_TEMPLATE_CATEGORIES.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                {formatEmailCategory(cat)}
              </h2>
              <Card className="divide-y p-0">
                {items.map((t) => (
                  <Link
                    key={t.id}
                    href={`/app/email-templates/${t.id}`}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{t.name}</div>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {t.subject}
                      </p>
                    </div>
                    {!t.isActive ? (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        inactive
                      </span>
                    ) : null}
                  </Link>
                ))}
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
}
