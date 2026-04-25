import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        We couldn&apos;t find the page you&apos;re looking for.
      </p>
      <Link href="/app" className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
