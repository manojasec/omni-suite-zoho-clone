import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { sendVisitorMessageAction } from "@/app/(app)/app/chat/actions";

export const dynamic = "force-dynamic";

export default async function PublicChatThreadPage({
  params,
}: {
  params: Promise<{ slug: string; publicId: string }>;
}) {
  const { slug, publicId } = await params;

  const ws = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, accentColor: true },
  });
  if (!ws) notFound();

  const conv = await prisma.chatConversation.findFirst({
    where: { publicId, workspaceId: ws.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { agent: { select: { name: true } } },
      },
    },
  });
  if (!conv) notFound();

  const isClosed = conv.status === "CLOSED";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col p-4">
      <AutoRefresh intervalMs={4000} />
      <Card className="flex flex-1 flex-col p-4">
        <div className="mb-3 border-b pb-3">
          <div
            className="mb-2 inline-block h-2 w-12 rounded-full"
            style={{ backgroundColor: ws.accentColor ?? "#0F172A" }}
          />
          <h1 className="text-base font-semibold">Chat with {ws.name}</h1>
          <p className="text-xs text-muted-foreground">
            {isClosed ? "This conversation is closed." : "We'll reply right here."}
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {conv.messages.map((m) => {
            const isVisitor = m.sender === "VISITOR";
            const isSystem = m.sender === "SYSTEM";
            return (
              <div key={m.id} className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isSystem
                      ? "bg-muted text-muted-foreground italic"
                      : isVisitor
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  }`}
                >
                  <div className="text-xs opacity-70 mb-0.5">
                    {isVisitor
                      ? "You"
                      : isSystem
                        ? "System"
                        : (m.agent?.name ?? "Support")}
                    {" · "}
                    {m.createdAt.toISOString().slice(11, 16)}
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {!isClosed ? (
          <form
            action={sendVisitorMessageAction.bind(null, slug, publicId)}
            className="mt-3 space-y-2 border-t pt-3"
          >
            <Label htmlFor="body" className="sr-only">Message</Label>
            <Textarea id="body" name="body" rows={2} placeholder="Type a message…" required />
            <Button type="submit" className="w-full" size="sm">Send</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
