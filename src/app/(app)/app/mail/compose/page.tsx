import Link from "next/link";
import { requireSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { assertCan } from "@/platform/permissions";
import { composeMailAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ComposeMailPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "mailMessage", "send");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/mail" className="text-xs text-muted-foreground hover:underline">
          ← Mail
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New message</h1>
        <p className="text-sm text-muted-foreground">
          Sending as <span className="font-medium">{ctx.email}</span>
        </p>
      </div>

      <Card className="p-6">
        <form action={composeMailAction} className="space-y-3">
          <div>
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              name="to"
              placeholder="recipient@example.com, another@example.com"
              required
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="cc">Cc</Label>
              <Input id="cc" name="cc" />
            </div>
            <div>
              <Label htmlFor="bcc">Bcc</Label>
              <Input id="bcc" name="bcc" />
            </div>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" required />
          </div>
          <div>
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" name="body" rows={10} required />
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/mail">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit">Send</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
