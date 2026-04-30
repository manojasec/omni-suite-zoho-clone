import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lightweight health probe: returns ok when the app + database are reachable.
 * Intended for uptime monitors and load-balancer health checks. Does not
 * require authentication.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        error: err instanceof Error ? err.message : "unknown",
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
