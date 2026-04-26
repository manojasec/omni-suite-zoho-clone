import Link from "next/link";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EventRegisteredPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
      <Card className="p-8 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re registered!</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;ve saved your spot. Save your ticket code to use at check-in.
        </p>
        {code ? (
          <p className="rounded border bg-muted px-4 py-2 font-mono text-lg tracking-wide">{code}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          <Link href={`/e/${slug}`} className="hover:underline">Back to event page</Link>
        </p>
      </Card>
    </div>
  );
}
