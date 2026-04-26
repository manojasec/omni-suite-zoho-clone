import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from "@/modules/events/schemas";
import { createEventAction } from "../actions";

export default async function NewEventPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "create");
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">New event</h1>
      <Card className="p-6">
        <form action={createEventAction} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} autoFocus />
            </div>
            <div>
              <Label htmlFor="slug">Slug (public URL)</Label>
              <Input id="slug" name="slug" maxLength={120} placeholder="auto from title" />
            </div>
          </div>
          <div>
            <Label htmlFor="summary">Summary</Label>
            <Input id="summary" name="summary" maxLength={500} placeholder="One-liner shown in lists and cards" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} maxLength={10000} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="startsAt">Starts at</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="endsAt">Ends at</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" required />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" maxLength={300} placeholder="Venue or city" />
            </div>
            <div>
              <Label htmlFor="capacity">Capacity</Label>
              <Input id="capacity" name="capacity" type="number" min={1} placeholder="Unlimited" />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isVirtual" /> Virtual event
            </label>
            <div>
              <Label htmlFor="meetingUrl">Meeting URL</Label>
              <Input id="meetingUrl" name="meetingUrl" maxLength={500} placeholder="https://..." />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="DRAFT">
                {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="coverImageUrl">Cover image URL</Label>
              <Input id="coverImageUrl" name="coverImageUrl" maxLength={500} />
            </div>
          </div>
          <Button type="submit">Create event</Button>
        </form>
      </Card>
    </div>
  );
}
