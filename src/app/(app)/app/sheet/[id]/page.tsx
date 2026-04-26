import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SHEET_STATUS_LABELS,
  colToLetter,
  formatDateTime,
  renderCells,
} from "@/modules/sheet/schemas";
import {
  clearSheetAction,
  deleteSheetAction,
  setSheetCellAction,
  setSheetStatusAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function SheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "sheet", "view");

  const sheet = await prisma.sheet.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      cells: {
        select: { row: true, col: true, value: true, formula: true },
      },
    },
  });
  if (!sheet) notFound();

  const canEdit = can(ctx.role, "sheet", "edit");
  const canDelete = can(ctx.role, "sheet", "delete");

  const rendered = renderCells(sheet.cells);
  const rawByKey = new Map<string, { value: string; formula: string | null }>();
  for (const c of sheet.cells) {
    rawByKey.set(`${c.row}:${c.col}`, {
      value: c.value ?? "",
      formula: c.formula,
    });
  }

  const rows = Array.from({ length: sheet.rowCount }, (_, r) => r);
  const cols = Array.from({ length: sheet.colCount }, (_, c) => c);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sheet.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {sheet.rowCount}×{sheet.colCount} grid · {sheet.cells.length} cell
            {sheet.cells.length === 1 ? "" : "s"} · updated{" "}
            {formatDateTime(sheet.updatedAt)}
            {sheet.description ? ` · ${sheet.description}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[sheet.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {SHEET_STATUS_LABELS[sheet.status]}
          </span>
          {canEdit ? (
            <form action={setSheetStatusAction.bind(null, sheet.id)}>
              <input
                type="hidden"
                name="status"
                value={sheet.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"}
              />
              <Button type="submit" size="sm" variant="outline">
                {sheet.status === "ACTIVE" ? "Archive" : "Restore"}
              </Button>
            </form>
          ) : null}
          {canEdit ? (
            <form action={clearSheetAction.bind(null, sheet.id)}>
              <Button type="submit" size="sm" variant="outline">
                Clear cells
              </Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteSheetAction.bind(null, sheet.id)}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
          <Link
            href="/app/sheet"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-r bg-muted/50 px-2 py-1 text-muted-foreground">
                #
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className="border-b border-r bg-muted/50 px-2 py-1 font-medium text-muted-foreground"
                >
                  {colToLetter(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 border-b border-r bg-muted/30 px-2 py-1 text-muted-foreground">
                  {r + 1}
                </td>
                {cols.map((c) => {
                  const key = `${r}:${c}`;
                  const raw = rawByKey.get(key);
                  const display = rendered.get(key) ?? "";
                  const isFormula = raw?.formula != null;
                  return (
                    <td
                      key={c}
                      className="border-b border-r p-0 align-top"
                      title={
                        isFormula
                          ? `${raw?.value} = ${display}`
                          : undefined
                      }
                    >
                      {canEdit ? (
                        <form
                          action={setSheetCellAction.bind(null, sheet.id)}
                          className="contents"
                        >
                          <input type="hidden" name="row" value={r} />
                          <input type="hidden" name="col" value={c} />
                          <input
                            name="value"
                            defaultValue={raw?.value ?? ""}
                            data-display={display}
                            className={
                              "w-24 bg-transparent px-2 py-1 outline-none focus:bg-accent/20 " +
                              (isFormula ? "text-emerald-700" : "")
                            }
                          />
                        </form>
                      ) : (
                        <div className="px-2 py-1">{display}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tip: type <code>=SUM(A1:A5)</code>, <code>=AVG(B1:B10)</code>,{" "}
        <code>=A1</code>, or a literal value. Press Enter or Tab to save each
        cell.
      </p>
    </div>
  );
}
