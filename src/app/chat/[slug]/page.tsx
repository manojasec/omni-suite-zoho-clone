import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { startVisitorChatAction } from "@/app/(app)/app/chat/actions";

export const dynamic = "force-dynamic";

export default async function PublicChatStartPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: { name: true, accentColor: true },
  });
  if (!ws) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <Card className="p-6">
        <div className="mb-4">
          <div
            className="mb-2 inline-block h-2 w-12 rounded-full"
            style={{ backgroundColor: ws.accentColor ?? "#0F172A" }}
          />
          <h1 className="text-xl font-semibold">Chat with {ws.name}</h1>
          <p className="text-sm text-muted-foreground">
            Send us a message and a team member will get back to you shortly.
          </p>
        </div>
        <form action={startVisitorChatAction.bind(null, slug)} className="space-y-3">
          <div>
            <Label htmlFor="visitorName">Your name</Label>
            <Input id="visitorName" name="visitorName" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="visitorEmail">Email</Label>
            <Input id="visitorEmail" name="visitorEmail" type="email" placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="message">How can we help?</Label>
            <Textarea id="message" name="message" rows={4} required />
          </div>
          <Button type="submit" className="w-full">Start conversation</Button>
        </form>
      </Card>
    </div>
  );
}
