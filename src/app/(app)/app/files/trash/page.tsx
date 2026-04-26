import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2 } from "lucide-react";
import { formatBytes, fileIconKind } from "@/modules/files/schemas";
import { deleteFileAction, restoreFileAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "view");
  const files = await prisma.fileAsset.findMany({
    where: { workspaceId: ctx.workspaceId, trashedAt: { not: null } },
    orderBy: { trashedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <Link href="/app/files" className="text-xs text-muted-foreground hover:underline">← Files</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Trash2 className="h-5 w-5" />Trash</h1>
        <p className="text-sm text-muted-foreground">Trashed files can be restored or permanently deleted.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2 text-left">Trashed</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span>{f.name}</span></div></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fileIconKind(f.mimeType)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatBytes(f.sizeBytes)}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.trashedAt?.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  {can(ctx.role, "fileAsset", "edit") ? (
                    <form action={restoreFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">Restore</Button>
                    </form>
                  ) : null}
                  {can(ctx.role, "fileAsset", "delete") ? (
                    <form action={deleteFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">Delete forever</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {files.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Trash is empty.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
