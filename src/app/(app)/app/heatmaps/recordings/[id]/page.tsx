import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SESSION_RECORDING_STATUS_LABELS,
  SESSION_RECORDING_TRANSITIONS,
  formatDate,
  formatDuration,
} from "@/modules/heatmaps/schemas";
import {
  deleteRecordingAction,
  transitionRecordingAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  RECORDING: "bg-rose-100 text-rose-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-100 text-zinc-700",
};

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "sessionRecording", "view");

  const recording = await prisma.sessionRecording.findFirst({
    where: { id, site: { workspaceId: ctx.workspaceId } },
    include: { site: { select: { id: true, name: true, domain: true } } },
  });
  if (!recording) notFound();

  const events = await prisma.sessionEvent.findMany({
    where: { recordingId: recording.id },
    orderBy: { offsetMs: "asc" },
    take: 500,
  });

  const canEdit = can(ctx.role, "sessionRecording", "edit");
  const canDelete = can(ctx.role, "sessionRecording", "delete");
  const transitions = SESSION_RECORDING_TRANSITIONS[recording.status];
  const transitionBound = transitionRecordingAction.bind(null, recording.id);
  const deleteBound = deleteRecordingAction.bind(null, recording.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Session {recording.visitorId.slice(0, 12)}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/heatmaps/${recording.site.id}`}
              className="hover:underline"
            >
              {recording.site.name}
            </Link>{" "}
            · {recording.site.domain}
          </p>
        </div>
        <span
          className={
            "rounded px-2 py-0.5 text-xs font-medium " +
            (statusColor[recording.status] ?? "bg-zinc-100 text-zinc-700")
          }
        >
          {SESSION_RECORDING_STATUS_LABELS[recording.status]}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Started</div>
          <div className="mt-1 text-sm font-semibold">
            {formatDate(recording.startedAt)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Duration</div>
          <div className="mt-1 text-sm font-semibold">
            {formatDuration(recording.durationMs)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pages</div>
          <div className="mt-1 text-sm font-semibold">{recording.pageCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Events</div>
          <div className="mt-1 text-sm font-semibold">{recording.eventCount}</div>
        </Card>
      </div>

      {canEdit && transitions.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Transition</h2>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <form key={t} action={transitionBound}>
                <input type="hidden" name="to" value={t} />
                <Button type="submit" size="sm" variant="outline">
                  Mark {SESSION_RECORDING_STATUS_LABELS[t]}
                </Button>
              </form>
            ))}
            {canDelete && recording.status !== "RECORDING" ? (
              <form action={deleteBound} className="ml-auto">
                <Button type="submit" size="sm" variant="outline">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Event timeline</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events captured.</p>
        ) : (
          <ul className="divide-y text-sm">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.kind}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {e.payload ? JSON.stringify(e.payload).slice(0, 160) : "—"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  +{formatDuration(e.offsetMs)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 text-xs text-muted-foreground">
        <div>
          <strong>Start URL:</strong> {recording.startUrl}
        </div>
        {recording.userAgent ? (
          <div className="mt-1">
            <strong>User agent:</strong> {recording.userAgent}
          </div>
        ) : null}
        {recording.ipAddress ? (
          <div className="mt-1">
            <strong>IP:</strong> {recording.ipAddress}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
