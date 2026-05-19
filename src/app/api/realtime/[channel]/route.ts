import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribe, encodeSse } from "@/platform/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events endpoint.
 *
 *   GET /api/realtime/<channel>
 *
 * Channel naming:
 *   - "ws:<workspaceId>:..."  → requires an authenticated membership in workspaceId.
 *   - "public:..."            → open to all (used by external chat widget, etc.)
 *
 * Wire: standard text/event-stream, browser EventSource compatible.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ channel: string }> },
) {
  const { channel: rawChannel } = await params;
  const channel = decodeURIComponent(rawChannel);

  if (channel.startsWith("ws:")) {
    const workspaceId = channel.split(":")[1];
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, workspaceId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (!channel.startsWith("public:")) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      // Initial comment to flush headers.
      controller.enqueue(enc.encode(": connected\n\n"));
      // Heartbeat every 25s keeps proxies from killing the connection.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          /* ignore */
        }
      }, 25_000);
      const unsubscribe = subscribe(channel, (event) => {
        try {
          controller.enqueue(enc.encode(encodeSse(event)));
        } catch {
          /* connection closed */
        }
      });
      const onAbort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
