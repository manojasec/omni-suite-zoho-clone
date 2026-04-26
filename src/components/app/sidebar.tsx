"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, Target, Receipt, FileText, FolderKanban,
  CheckSquare, LifeBuoy, FormInput, Send, BarChart3, Settings, Inbox, UserPlus,
  ClipboardList,
  Warehouse, Package, Truck, ShoppingCart,
  Wallet, IdCard, CalendarClock, Clock,
  PenLine, CalendarDays, CalendarRange, Bug, MessageCircle, Workflow, Mail,
  BookOpen, Landmark, Scale, BookText, ScrollText,
  Briefcase, UserCircle, Calendar,
  FolderOpen, HardDrive,
  Repeat,
  StickyNote,
  KeyRound,
  PartyPopper,
  Hash,
  Globe,
  Megaphone,
  Newspaper,
  Flame,
  FlaskConical,
  GraduationCap,
  Banknote,
  Laptop,
  GitPullRequest,
  AlertTriangle,
  Store,
  ShoppingBag,
  UsersRound,
  ShieldCheck,
  LogIn,
  MousePointerClick,
  Video,
  Workflow,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label?: string; items: Item[] };

const groups: Group[] = [
  {
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/inbox", label: "Inbox", icon: Inbox },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/app/crm/contacts", label: "Contacts", icon: Users },
      { href: "/app/crm/leads", label: "Leads", icon: UserPlus },
      { href: "/app/crm/companies", label: "Companies", icon: Building2 },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/app/sales/pipeline", label: "Pipeline", icon: Target },
      { href: "/app/sales/deals", label: "Deals", icon: Target },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/app/billing/invoices", label: "Invoices", icon: Receipt },
      { href: "/app/billing/customers", label: "Customers", icon: Users },
      { href: "/app/billing/products", label: "Products", icon: FileText },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/app/inventory/items", label: "Items", icon: Package },
      { href: "/app/inventory/warehouses", label: "Warehouses", icon: Warehouse },
      { href: "/app/inventory/suppliers", label: "Suppliers", icon: Truck },
      { href: "/app/inventory/purchase-orders", label: "Purchase orders", icon: ShoppingCart },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/app/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  {
    label: "Accounting",
    items: [
      { href: "/app/accounting", label: "Overview", icon: BookOpen },
      { href: "/app/accounting/accounts", label: "Chart of accounts", icon: BookText },
      { href: "/app/accounting/journals", label: "Journals", icon: ScrollText },
      { href: "/app/accounting/banks", label: "Banks", icon: Landmark },
      { href: "/app/accounting/reports", label: "Reports", icon: Scale },
    ],
  },
  {
    label: "Subscriptions",
    items: [
      { href: "/app/subscriptions", label: "Overview", icon: Repeat },
      { href: "/app/subscriptions/plans", label: "Plans", icon: Package },
      { href: "/app/subscriptions/list", label: "Subscriptions", icon: Repeat },
      { href: "/app/subscriptions/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "HR",
    items: [
      { href: "/app/hr", label: "Overview", icon: IdCard },
      { href: "/app/hr/employees", label: "Employees", icon: Users },
      { href: "/app/hr/leave", label: "Leave", icon: CalendarClock },
      { href: "/app/hr/attendance", label: "Attendance", icon: Clock },
      { href: "/app/hr/payroll", label: "Payroll", icon: Banknote },
      { href: "/app/learn", label: "Learn", icon: GraduationCap },
    ],
  },
  {
    label: "Recruit",
    items: [
      { href: "/app/recruit", label: "Overview", icon: Briefcase },
      { href: "/app/recruit/jobs", label: "Jobs", icon: Briefcase },
      { href: "/app/recruit/candidates", label: "Candidates", icon: UserCircle },
      { href: "/app/recruit/pipeline", label: "Pipeline", icon: Workflow },
      { href: "/app/recruit/interviews", label: "Interviews", icon: Calendar },
    ],
  },
  {
    label: "Documents",
    items: [
      { href: "/app/files", label: "Files", icon: HardDrive },
      { href: "/app/files/starred", label: "Starred", icon: FolderOpen },
      { href: "/app/notes", label: "Notes", icon: StickyNote },
      { href: "/app/vault", label: "Vault", icon: KeyRound },
      { href: "/app/esign", label: "E-Signature", icon: PenLine },
    ],
  },
  {
    label: "Bookings",
    items: [
      { href: "/app/bookings", label: "Appointments", icon: CalendarDays },
      { href: "/app/bookings/types", label: "Booking pages", icon: CalendarRange },
      { href: "/app/events", label: "Events", icon: PartyPopper },
    ],
  },
  {
    label: "Engineering",
    items: [
      { href: "/app/bugs", label: "Bug Tracker", icon: Bug },
    ],
  },
  {
    label: "Conversations",
    items: [
      { href: "/app/chat", label: "Live Chat", icon: MessageCircle },
      { href: "/app/channels", label: "Channels", icon: Hash },
      { href: "/app/connect", label: "Connect", icon: Newspaper },
      { href: "/app/mail", label: "Mail", icon: Mail },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/app/projects", label: "Projects", icon: FolderKanban },
      { href: "/app/tasks", label: "My tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Service",
    items: [
      { href: "/app/helpdesk/tickets", label: "Tickets", icon: LifeBuoy },
      { href: "/app/itsm/assets", label: "IT assets", icon: Laptop },
      { href: "/app/itsm/changes", label: "Changes", icon: GitPullRequest },
      { href: "/app/itsm/problems", label: "Problems", icon: AlertTriangle },
      { href: "/app/forms", label: "Forms", icon: FormInput },
      { href: "/app/surveys", label: "Surveys", icon: ClipboardList },
    ],
  },
  {
    label: "Storefront",
    items: [
      { href: "/app/store", label: "Storefront", icon: Store },
      { href: "/app/store/customers", label: "Customers", icon: UsersRound },
      { href: "/app/store/orders", label: "Orders", icon: ShoppingBag },
    ],
  },
  {
    label: "Identity",
    items: [
      { href: "/app/sso", label: "Single sign-on", icon: ShieldCheck },
      { href: "/app/sso/events", label: "Login events", icon: LogIn },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/app/heatmaps", label: "Heatmaps", icon: MousePointerClick },
      { href: "/app/heatmaps/recordings", label: "Recordings", icon: Video },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/app/flows", label: "Command Center", icon: Workflow },
      { href: "/app/flows/runs", label: "Flow runs", icon: Activity },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/app/campaigns", label: "Campaigns", icon: Send },
      { href: "/app/automation", label: "Automation", icon: Workflow },
      { href: "/app/scoring", label: "Lead scoring", icon: Flame },
      { href: "/app/experiments", label: "Experiments", icon: FlaskConical },
      { href: "/app/sites", label: "Sites", icon: Globe },
      { href: "/app/social", label: "Social", icon: Megaphone },
      { href: "/app/reports", label: "Reports", icon: BarChart3 },
      { href: "/app/reports/dashboards", label: "Dashboards", icon: BarChart3 },
      { href: "/app/reports/pivots", label: "Pivot tables", icon: BarChart3 },
    ],
  },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-base font-semibold tracking-tight">OmniSuite</span>
      </div>
      <div className="border-b px-4 py-3">
        <div className="text-xs uppercase text-muted-foreground">Workspace</div>
        <div className="truncate text-sm font-medium">{workspaceName}</div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((g, i) => (
          <div key={i}>
            {g.label ? (
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{it.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <Link
          href="/app/settings/workspace"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            pathname.startsWith("/app/settings")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
