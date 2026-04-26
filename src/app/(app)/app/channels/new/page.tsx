import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createChannelAction } from "../actions";

export default async function NewChannelPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "create");
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">New channel</h1>
      <Card className="p-6">
        <form action={createChannelAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={80} placeholder="design-team" autoFocus />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, numbers, dots, dashes, underscores.
            </p>
          </div>
          <div>
            <Label htmlFor="topic">Topic (optional)</Label>
            <Input id="topic" name="topic" maxLength={300} placeholder="What this channel is about" />
          </div>
          <div>
            <Label htmlFor="kind">Visibility</Label>
            <Select id="kind" name="kind" defaultValue="PUBLIC">
              <option value="PUBLIC">Public — anyone in the workspace can join</option>
              <option value="PRIVATE">Private — invite only</option>
            </Select>
          </div>
          <Button type="submit">Create channel</Button>
        </form>
      </Card>
    </div>
  );
}
