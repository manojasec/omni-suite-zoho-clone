"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  app: "Dashboard",
  crm: "CRM",
  contacts: "Contacts",
  companies: "Companies",
  sales: "Sales",
  pipeline: "Pipeline",
  deals: "Deals",
  billing: "Billing",
  invoices: "Invoices",
  customers: "Customers",
  products: "Products",
  projects: "Projects",
  tasks: "My tasks",
  helpdesk: "Helpdesk",
  tickets: "Tickets",
  forms: "Forms",
  campaigns: "Campaigns",
  reports: "Reports",
  dashboards: "Dashboards",
  pivots: "Pivot tables",
  notes: "Notes",
  vault: "Vault",
  events: "Events",
  registrations: "Registrations",
  channels: "Channels",
  sites: "Sites",
  pages: "Pages",
  social: "Social",
  connect: "Connect",
  groups: "Groups",
  scoring: "Lead scoring",
  experiments: "Experiments",
  learn: "Learn",
  courses: "Courses",
  lessons: "Lessons",
  enrollments: "Enrollments",
  payroll: "Payroll",
  slips: "Pay slips",
  itsm: "ITSM",
  assets: "IT assets",
  changes: "Changes",
  problems: "Problems",
  store: "Storefront",
  orders: "Orders",
  sso: "Single sign-on",
  surveys: "Surveys",
  responses: "Responses",
  inbox: "Inbox",
  settings: "Settings",
  workspace: "Workspace",
  users: "Users",
  roles: "Roles",
  teams: "Teams",
  branding: "Branding",
  security: "Security",
  "audit-log": "Audit log",
  "api-keys": "API keys",
  webhooks: "Webhooks",
  integrations: "Integrations",
  pipelines: "Pipelines",
  "ticket-statuses": "Ticket statuses",
  sla: "SLA",
  taxes: "Taxes",
  "custom-fields": "Custom fields",
  profile: "Profile",
  new: "New",
  inventory: "Inventory",
  warehouses: "Warehouses",
  items: "Items",
  suppliers: "Suppliers",
  "purchase-orders": "Purchase orders",
  stock: "Stock",
  expenses: "Expenses",
  categories: "Categories",
  hr: "HR",
  employees: "Employees",
  departments: "Departments",
  leave: "Leave",
  "leave-types": "Leave types",
  attendance: "Attendance",
  esign: "E-Signature",
  bookings: "Bookings",
  types: "Booking pages",
  bugs: "Bug Tracker",
  issues: "Issues",
  chat: "Live Chat",
  automation: "Automation",
  mail: "Mail",
  compose: "Compose",
  operations: "Operations",
  accounting: "Accounting",
  accounts: "Accounts",
  journals: "Journals",
  banks: "Banks",
  "trial-balance": "Trial balance",
  pnl: "Profit & loss",
  "balance-sheet": "Balance sheet",
  recruit: "Recruit",
  jobs: "Jobs",
  candidates: "Candidates",
  applications: "Applications",
  interviews: "Interviews",
  files: "Files",
  starred: "Starred",
  trash: "Trash",
  subscriptions: "Subscriptions",
  plans: "Plans",
  list: "All",
};

function label(seg: string) {
  return LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  // Hide outside the app shell
  if (parts[0] !== "app") return null;

  // Build cumulative paths, skip raw IDs (cuid pattern)
  const items = parts.map((seg, i) => {
    const href = "/" + parts.slice(0, i + 1).join("/");
    const isId = /^[a-z0-9]{20,}$/i.test(seg);
    return { seg, href, isId };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const text = it.isId ? "Detail" : label(it.seg);
        return (
          <span key={it.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {isLast ? (
              <span className="font-medium text-foreground">{text}</span>
            ) : (
              <Link href={it.href} className="hover:text-foreground hover:underline">
                {text}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
