import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Star } from "lucide-react";
import { formatBytes, fileIconKind } from "@/modules/files/schemas";
import { toggleStarFileAction, trashFileAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function StarredFilesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "fileAsset", "view");
  const files = await prisma.fileAsset.findMany({
    where: { workspaceId: ctx.workspaceId, starred: true, trashedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { folder: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-4">
      <Link href="/app/files" className="text-xs text-muted-foreground hover:underline">← Files</Link>
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />Starred</h1>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Folder</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-right">Size</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span>{f.name}</span></div></td>
                <td className="px-3 py-2 text-muted-foreground">
                  {f.folder ? <Link href={`/app/files/${f.folder.id}`} className="hover:underline">{f.folder.name}</Link> : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fileIconKind(f.mimeType)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{formatBytes(f.sizeBytes)}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  {can(ctx.role, "fileAsset", "edit") ? (
                    <form action={toggleStarFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">Unstar</Button>
                    </form>
                  ) : null}
                  {can(ctx.role, "fileAsset", "delete") ? (
                    <form action={trashFileAction.bind(null, f.id)} className="inline">
                      <Button type="submit" size="sm" variant="ghost">Trash</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {files.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No starred files.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
