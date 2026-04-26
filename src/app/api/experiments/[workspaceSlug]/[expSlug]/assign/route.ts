import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignVariant, assignSchema } from "@/modules/experiments/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceSlug: string; expSlug: string }> },
) {
  const { workspaceSlug, expSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }

  const experiment = await prisma.experiment.findFirst({
    where: { workspaceId: workspace.id, slug: expSlug },
    include: { variants: true },
  });
  if (!experiment) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }
  if (experiment.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Experiment not running", status: experiment.status },
      { status: 409, headers: corsHeaders },
    );
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders });
  }
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Reuse existing assignment if present (sticky bucketing across requests).
  const existing = await prisma.experimentAssignment.findUnique({
    where: { experimentId_visitorId: { experimentId: experiment.id, visitorId: parsed.data.visitorId } },
  });
  if (existing) {
    return NextResponse.json(
      { variantKey: existing.variantKey, sticky: true },
      { headers: corsHeaders },
    );
  }

  const variantKey = assignVariant(experiment.id, parsed.data.visitorId, experiment.variants);
  await prisma.experimentAssignment.create({
    data: { experimentId: experiment.id, visitorId: parsed.data.visitorId, variantKey },
  });
  return NextResponse.json(
    { variantKey, sticky: false },
    { headers: corsHeaders },
  );
}
