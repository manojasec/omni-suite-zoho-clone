import { prisma } from "@/lib/prisma";
import { can } from "@/platform/permissions";
import type { SystemRole } from "@prisma/client";

export type SearchHit = {
  module:
    | "contacts"
    | "companies"
    | "deals"
    | "invoices"
    | "projects"
    | "tasks"
    | "tickets"
    | "meetings"
    | "channels"
    | "inboxes"
    | "datasets"
    | "functions"
    | "assist";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const PER_MODULE = 5;

/**
 * Search a single workspace across major record types. Each query is bounded
 * and uses case-insensitive contains. Results are filtered by the caller's
 * role using the `can(role, resource, "view")` check.
 */
export async function globalSearch(
  workspaceId: string,
  role: SystemRole,
  rawQuery: string,
): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const contains = { contains: q };

  const tasks: Promise<SearchHit[]>[] = [];

  if (can(role, "contact", "view")) {
    tasks.push(
      prisma.contact
        .findMany({
          where: {
            workspaceId,
            OR: [
              { firstName: contains },
              { lastName: contains },
              { email: contains },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "contacts" as const,
            id: r.id,
            title: `${r.firstName} ${r.lastName ?? ""}`.trim(),
            subtitle: r.email ?? undefined,
            href: `/app/contacts/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "company", "view")) {
    tasks.push(
      prisma.company
        .findMany({
          where: {
            workspaceId,
            OR: [{ name: contains }, { domain: contains }],
          },
          select: { id: true, name: true, domain: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "companies" as const,
            id: r.id,
            title: r.name,
            subtitle: r.domain ?? undefined,
            href: `/app/companies/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "deal", "view")) {
    tasks.push(
      prisma.deal
        .findMany({
          where: { workspaceId, name: contains },
          select: { id: true, name: true, status: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "deals" as const,
            id: r.id,
            title: r.name,
            subtitle: r.status,
            href: `/app/deals/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "invoice", "view")) {
    tasks.push(
      prisma.invoice
        .findMany({
          where: {
            workspaceId,
            OR: [{ number: contains }, { notes: contains }],
          },
          select: { id: true, number: true, status: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "invoices" as const,
            id: r.id,
            title: r.number,
            subtitle: r.status,
            href: `/app/billing/invoices/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "project", "view")) {
    tasks.push(
      prisma.project
        .findMany({
          where: { workspaceId, name: contains },
          select: { id: true, name: true, status: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "projects" as const,
            id: r.id,
            title: r.name,
            subtitle: r.status,
            href: `/app/projects/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "task", "view")) {
    tasks.push(
      prisma.task
        .findMany({
          where: { workspaceId, title: contains },
          select: { id: true, title: true, status: true, projectId: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "tasks" as const,
            id: r.id,
            title: r.title,
            subtitle: r.status,
            href: r.projectId ? `/app/projects/${r.projectId}` : "/app/tasks",
          })),
        ),
    );
  }

  if (can(role, "ticket", "view")) {
    tasks.push(
      prisma.ticket
        .findMany({
          where: { workspaceId, subject: contains },
          select: { id: true, subject: true, status: true, number: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "tickets" as const,
            id: r.id,
            title: `#${r.number} ${r.subject}`,
            subtitle: r.status,
            href: `/app/helpdesk/tickets/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "meeting", "view")) {
    tasks.push(
      prisma.meeting
        .findMany({
          where: { workspaceId, title: contains },
          select: { id: true, title: true, status: true, kind: true },
          take: PER_MODULE,
          orderBy: { scheduledAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "meetings" as const,
            id: r.id,
            title: r.title,
            subtitle: `${r.kind} · ${r.status}`,
            href: `/app/meetings/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "channel", "view")) {
    tasks.push(
      prisma.channel
        .findMany({
          where: {
            workspaceId,
            OR: [{ name: contains }, { topic: contains }],
          },
          select: { id: true, name: true, topic: true, kind: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "channels" as const,
            id: r.id,
            title: `#${r.name}`,
            subtitle: r.topic ?? r.kind,
            href: `/app/cliq/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "sharedInbox", "view")) {
    tasks.push(
      prisma.sharedInbox
        .findMany({
          where: {
            workspaceId,
            OR: [{ name: contains }, { address: contains }],
          },
          select: { id: true, name: true, address: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "inboxes" as const,
            id: r.id,
            title: r.name,
            subtitle: r.address,
            href: `/app/teaminbox/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "dataPrepDataset", "view")) {
    tasks.push(
      prisma.dataPrepDataset
        .findMany({
          where: { workspaceId, name: contains },
          select: { id: true, name: true, status: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "datasets" as const,
            id: r.id,
            title: r.name,
            subtitle: r.status,
            href: `/app/dataprep/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "catalystFunction", "view")) {
    tasks.push(
      prisma.catalystFunction
        .findMany({
          where: {
            workspaceId,
            OR: [{ name: contains }, { slug: contains }],
          },
          select: { id: true, name: true, slug: true, status: true },
          take: PER_MODULE,
          orderBy: { updatedAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "functions" as const,
            id: r.id,
            title: r.name,
            subtitle: `/${r.slug}`,
            href: `/app/catalyst/${r.id}`,
          })),
        ),
    );
  }

  if (can(role, "assistSession", "view")) {
    tasks.push(
      prisma.assistSession
        .findMany({
          where: {
            workspaceId,
            OR: [
              { customerName: contains },
              { customerEmail: contains },
              { code: contains },
            ],
          },
          select: {
            id: true,
            customerName: true,
            code: true,
            status: true,
          },
          take: PER_MODULE,
          orderBy: { createdAt: "desc" },
        })
        .then((rows) =>
          rows.map((r) => ({
            module: "assist" as const,
            id: r.id,
            title: r.customerName,
            subtitle: `${r.code} · ${r.status}`,
            href: `/app/assist/${r.id}`,
          })),
        ),
    );
  }

  const settled = await Promise.all(tasks);
  return settled.flat();
}

export const MODULE_LABELS: Record<SearchHit["module"], string> = {
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  invoices: "Invoices",
  projects: "Projects",
  tasks: "Tasks",
  tickets: "Tickets",
  meetings: "Meetings",
  channels: "Channels",
  inboxes: "Team inboxes",
  datasets: "Datasets",
  functions: "Functions",
  assist: "Assist sessions",
};
