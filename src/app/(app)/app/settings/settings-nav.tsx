"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Workspace",
    items: [
      { href: "/app/settings/workspace", label: "General" },
      { href: "/app/settings/branding", label: "Branding" },
      { href: "/app/settings/billing", label: "Plan & billing" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/app/settings/users", label: "Users" },
      { href: "/app/settings/teams", label: "Teams" },
      { href: "/app/settings/roles", label: "Roles" },
    ],
  },
  {
    label: "Customization",
    items: [
      { href: "/app/settings/custom-fields", label: "Custom fields" },
      { href: "/app/settings/pipelines", label: "Pipelines" },
      { href: "/app/settings/ticket-statuses", label: "Ticket statuses" },
      { href: "/app/settings/sla", label: "SLA policies" },
      { href: "/app/settings/taxes", label: "Tax rates" },
    ],
  },
  {
    label: "Developer",
    items: [
      { href: "/app/settings/api-keys", label: "API keys" },
      { href: "/app/settings/webhooks", label: "Webhooks" },
      { href: "/app/settings/integrations", label: "Integrations" },
      { href: "/app/settings/audit-log", label: "Audit log" },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/app/settings/profile", label: "Profile" },
      { href: "/app/settings/security", label: "Security" },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.label}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = pathname === it.href;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
