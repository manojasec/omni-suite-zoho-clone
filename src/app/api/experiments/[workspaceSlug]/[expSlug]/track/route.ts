import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackEventSchema } from "@/modules/experiments/schemas";

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
    include: { variants: { select: { key: true } } },
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
  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400, headers: corsHeaders },
    );
  }

  // Variant must belong to this experiment.
  const knownVariant = experiment.variants.some((v) => v.key === parsed.data.variantKey);
  if (!knownVariant) {
    return NextResponse.json(
      { error: "Unknown variant" },
      { status: 400, headers: corsHeaders },
    );
  }

  await prisma.experimentEvent.create({
    data: {
      experimentId: experiment.id,
      variantKey: parsed.data.variantKey,
      visitorId: parsed.data.visitorId,
      kind: parsed.data.kind,
      value: parsed.data.value != null ? parsed.data.value : null,
    },
  });
  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
