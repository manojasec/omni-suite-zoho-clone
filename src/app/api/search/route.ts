import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { globalSearch } from "@/modules/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireSession();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const hits = await globalSearch(ctx.workspaceId, ctx.role, q);
  return NextResponse.json({ q, hits });
}
