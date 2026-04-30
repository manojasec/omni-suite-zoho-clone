import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Edge-style streaming response held open for ~25s, polling DB every 5s.
// In production, replace polling with a pub/sub backbone (Redis, Postgres LISTEN, etc).
export async function GET(req: NextRequest) {
  const ctx = await requireSession();
  const userId = ctx.userId;
  const workspaceId = ctx.workspaceId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      // Initial unread count
      const unread = await prisma.notification.count({
        where: { workspaceId, userId, readAt: null },
      });
      send("count", { unread });

      let lastSeen = new Date();
      let closed = false;
      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const fresh = await prisma.notification.findMany({
            where: {
              workspaceId,
              userId,
              createdAt: { gt: lastSeen },
            },
            orderBy: { createdAt: "asc" },
            take: 20,
            select: {
              id: true,
              type: true,
              title: true,
              body: true,
              href: true,
              createdAt: true,
            },
          });
          if (fresh.length) {
            for (const n of fresh) send("notification", n);
            lastSeen = fresh[fresh.length - 1].createdAt;
            const unread = await prisma.notification.count({
              where: { workspaceId, userId, readAt: null },
            });
            send("count", { unread });
          } else {
            send("ping", { t: Date.now() });
          }
        } catch {
          // ignore transient errors
        }
      }, 5000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Time-bound stream so dev/test environments don't accumulate connections.
      setTimeout(close, 25_000);
      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
