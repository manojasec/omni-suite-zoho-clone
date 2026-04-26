import Link from "next/link";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ApplicationThanksPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; jobSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <Card className="p-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Application received
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Thanks for applying. We've recorded your submission and will be in touch
          if there's a fit.
        </p>
        <div className="mt-6">
          <Link
            href={`/careers/${workspaceSlug}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to all open positions
          </Link>
        </div>
      </Card>
    </div>
  );
}
