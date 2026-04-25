import { ModuleStub } from "@/components/app/module-stub";
export default function InboxPage() {
  return (
    <ModuleStub
      title="Inbox"
      description="Notifications, assigned items, and @mentions in one place."
      milestone="M0"
      features={[
        "Notifications: assignments, comments, mentions, SLA breaches",
        "Filter by module and unread state",
        "Quick actions: open, snooze, mark done",
      ]}
    />
  );
}
