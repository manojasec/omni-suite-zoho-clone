import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  kind: z.enum(["CLICK", "MOVE", "SCROLL"]),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  sel: z.string().max(400).nullable().optional(),
});

const payloadSchema = z.object({
  key: z.string().min(8).max(40),
  path: z.string().min(1).max(400),
  viewport: z.number().int().positive().max(20000).optional(),
  events: z.array(eventSchema).min(1).max(200),
});

/**
 * POST /api/heatmap/track
 * Body: JSON { key, path, viewport, events: [...] }
 *
 * Validates the trackerKey, finds-or-creates the page, then bulk-inserts
 * events. Drops the request if site is paused or sample-rate excludes it.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { key, path, viewport, events } = parsed.data;

  const site = await prisma.heatmapSite.findUnique({ where: { trackerKey: key } });
  if (!site) {
    return NextResponse.json({ error: "unknown key" }, { status: 404 });
  }
  if (site.status !== "ACTIVE") {
    return NextResponse.json({ ok: true, dropped: "paused" });
  }
  if (site.sampleRate < 100 && Math.random() * 100 >= site.sampleRate) {
    return NextResponse.json({ ok: true, dropped: "sampled-out" });
  }

  // Cap path length, normalise.
  const safePath = path.startsWith("/") ? path.slice(0, 400) : `/${path}`.slice(0, 400);

  const page = await prisma.heatmapPage.upsert({
    where: { siteId_path: { siteId: site.id, path: safePath } },
    create: { siteId: site.id, path: safePath, viewCount: 1 },
    update: { viewCount: { increment: 1 } },
  });

  await prisma.heatmapEvent.createMany({
    data: events.map((e) => ({
      siteId: site.id,
      pageId: page.id,
      kind: e.kind,
      xPercent: e.x,
      yPercent: e.y,
      viewport: viewport ?? null,
      selector: e.sel ?? null,
    })),
  });

  return NextResponse.json({ ok: true, count: events.length });
}

/** CORS preflight for cross-origin tracking. */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
