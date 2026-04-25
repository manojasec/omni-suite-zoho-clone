import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You don't belong to a workspace yet</CardTitle>
          <CardDescription>Create a new workspace or accept an invitation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/signup"><Button className="w-full">Create a workspace</Button></Link>
          <p className="text-center text-xs text-muted-foreground">Have an invite link? Open it directly.</p>
        </CardContent>
      </Card>
    </main>
  );
}
