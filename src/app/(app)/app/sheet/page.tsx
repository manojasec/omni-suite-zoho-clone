import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SHEET_STATUSES,
  SHEET_STATUS_LABELS,
  formatDate,
  summarizeSheets,
} from "@/modules/sheet/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function SheetIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "view");

  const status =
    sp.status && SHEET_STATUSES.includes(sp.status as never)
      ? (sp.status as (typeof SHEET_STATUSES)[number])
      : undefined;

  const [sheets, summarySource] = await Promise.all([
    prisma.sheet.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        rowCount: true,
        colCount: true,
        updatedAt: true,
      },
    }),
    prisma.sheet.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { status: true },
    }),
  ]);

  const summary = summarizeSheets(summarySource);
  const canCreate = can(ctx.role, "sheet", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sheet</h1>
          <p className="text-sm text-muted-foreground">
            Lightweight spreadsheets with formulas (SUM, AVG, MIN, MAX, COUNT).
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/sheet/new">
            <Button size="sm">New sheet</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
        </Card>
        {SHEET_STATUSES.map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground">
              {SHEET_STATUS_LABELS[s]}
            </div>
            <div className="mt-1 text-2xl font-semibold">{summary[s]}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href="/app/sheet"
          className={
            "rounded px-2 py-1 " +
            (!status
              ? "bg-foreground text-background"
              : "bg-muted hover:bg-accent")
          }
        >
          All
        </Link>
        {SHEET_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/app/sheet?status=${s}`}
            className={
              "rounded px-2 py-1 " +
              (status === s
                ? "bg-foreground text-background"
                : "bg-muted hover:bg-accent")
            }
          >
            {SHEET_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {sheets.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No sheets yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {sheets.map((s) => (
            <Link
              key={s.id}
              href={`/app/sheet/${s.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.rowCount}×{s.colCount} grid · updated{" "}
                  {formatDate(s.updatedAt)}
                  {s.description ? ` · ${s.description}` : ""}
                </div>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[s.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {SHEET_STATUS_LABELS[s.status]}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
