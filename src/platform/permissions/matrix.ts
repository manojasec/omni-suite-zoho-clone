/**
 * OmniSuite permission system.
 *
 * Permissions are tuples of (resource, action). Roles are static maps from
 * resource → set of allowed actions. Resolution is server-authoritative; the
 * client hook is a convenience for hiding UI affordances.
 */
import type { SystemRole } from "@prisma/client";

export const RESOURCES = [
  "contact",
  "company",
  "lead",
  "deal",
  "pipeline",
  "invoice",
  "customer",
  "product",
  "project",
  "task",
  "ticket",
  "form",
  "campaign",
  "audience",
  "report",
  "auditLog",
  "warehouse",
  "inventoryItem",
  "supplier",
  "purchaseOrder",
  "expense",
  "expenseCategory",
  "employee",
  "department",
  "leaveType",
  "leaveRequest",
  "signatureEnvelope",
  "bookingType",
  "booking",
  "issueProject",
  "issue",
  "issueComment",
  "chatConversation",
  "chatMessage",
  "workflow",
  "workflowEnrollment",
  "mailThread",
  "mailMessage",
  "ledgerAccount",
  "journalEntry",
  "bankAccount",
  "bankTransaction",
  "jobOpening",
  "candidate",
  "application",
  "interview",
  "settings.workspace",
  "settings.users",
  "settings.billing",
  "settings.security",
  "settings.apiKeys",
  "settings.webhooks",
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "assign",
  "send",
  "manage",
] as const;

export type Action = (typeof ACTIONS)[number];

const ALL: readonly Action[] = ACTIONS;
const READ_ONLY: readonly Action[] = ["view"];
const READ_WRITE: readonly Action[] = ["view", "create", "edit"];
const READ_WRITE_DELETE: readonly Action[] = ["view", "create", "edit", "delete", "export"];

type RoleMatrix = Record<Resource, readonly Action[]>;

/** Owner can do anything. */
const ownerMatrix: RoleMatrix = Object.fromEntries(
  RESOURCES.map((r) => [r, ALL]),
) as RoleMatrix;

/** Admin: everything except destructive workspace ops are equivalent to Owner in MVP. */
const adminMatrix: RoleMatrix = ownerMatrix;

/** Manager: full operational control, can't change billing/users. */
const managerMatrix: RoleMatrix = {
  ...ownerMatrix,
  "settings.workspace": READ_ONLY,
  "settings.users": ["view"],
  "settings.billing": READ_ONLY,
  "settings.security": READ_ONLY,
  "settings.apiKeys": READ_ONLY,
  "settings.webhooks": READ_ONLY,
};

/** Sales rep: full CRM/Sales, read-only on the rest. */
const salesMatrix: RoleMatrix = {
  contact: READ_WRITE_DELETE,
  company: READ_WRITE_DELETE,
  lead: [...READ_WRITE_DELETE, "assign"],
  deal: [...READ_WRITE_DELETE, "assign"],
  pipeline: READ_ONLY,
  invoice: READ_WRITE,
  customer: READ_WRITE,
  product: READ_ONLY,
  project: READ_ONLY,
  task: READ_WRITE,
  ticket: READ_ONLY,
  form: READ_ONLY,
  campaign: READ_ONLY,
  audience: READ_ONLY,
  report: READ_ONLY,
  auditLog: [],
  warehouse: READ_ONLY,
  inventoryItem: READ_ONLY,
  supplier: READ_ONLY,
  purchaseOrder: [],
  expense: READ_WRITE,
  expenseCategory: READ_ONLY,
  employee: READ_ONLY,
  department: READ_ONLY,
  leaveType: READ_ONLY,
  leaveRequest: READ_WRITE,
  signatureEnvelope: READ_WRITE,
  bookingType: READ_WRITE,
  booking: READ_WRITE_DELETE,
  issueProject: READ_ONLY,
  issue: [...READ_WRITE_DELETE, "assign"],
  issueComment: READ_WRITE,
  chatConversation: [...READ_WRITE_DELETE, "assign"],
  chatMessage: [...READ_WRITE, "send"],
  workflow: [...READ_WRITE_DELETE, "manage"],
  workflowEnrollment: [...READ_WRITE_DELETE, "manage"],
  mailThread: READ_WRITE_DELETE,
  mailMessage: [...READ_WRITE, "send"],
  ledgerAccount: [],
  journalEntry: [],
  bankAccount: [],
  bankTransaction: [],
  jobOpening: READ_ONLY,
  candidate: READ_WRITE,
  application: READ_ONLY,
  interview: READ_ONLY,
  "settings.workspace": [],
  "settings.users": [],
  "settings.billing": [],
  "settings.security": [],
  "settings.apiKeys": [],
  "settings.webhooks": [],
};

/** Finance: full billing, read CRM. */
const financeMatrix: RoleMatrix = {
  contact: READ_ONLY,
  company: READ_ONLY,
  lead: [],
  deal: READ_ONLY,
  pipeline: [],
  invoice: [...READ_WRITE_DELETE, "send"],
  customer: READ_WRITE_DELETE,
  product: READ_WRITE_DELETE,
  project: READ_ONLY,
  task: [],
  ticket: [],
  form: [],
  campaign: [],
  audience: [],
  report: READ_ONLY,
  auditLog: READ_ONLY,
  warehouse: READ_WRITE_DELETE,
  inventoryItem: READ_WRITE_DELETE,
  supplier: READ_WRITE_DELETE,
  purchaseOrder: [...READ_WRITE_DELETE, "send"],
  expense: [...READ_WRITE_DELETE, "manage"],
  expenseCategory: READ_WRITE_DELETE,
  employee: READ_ONLY,
  department: READ_ONLY,
  leaveType: READ_ONLY,
  leaveRequest: READ_ONLY,
  signatureEnvelope: READ_ONLY,
  bookingType: READ_ONLY,
  booking: READ_ONLY,
  issueProject: [],
  issue: [],
  issueComment: [],
  chatConversation: [],
  chatMessage: [],
  workflow: [],
  workflowEnrollment: [],
  mailThread: READ_ONLY,
  mailMessage: READ_ONLY,
  ledgerAccount: READ_WRITE_DELETE,
  journalEntry: [...READ_WRITE_DELETE, "manage"],
  bankAccount: READ_WRITE_DELETE,
  bankTransaction: [...READ_WRITE_DELETE, "manage"],
  jobOpening: READ_ONLY,
  candidate: READ_ONLY,
  application: READ_ONLY,
  interview: READ_ONLY,
  "settings.workspace": READ_ONLY,
  "settings.users": [],
  "settings.billing": [...ALL],
  "settings.security": [],
  "settings.apiKeys": [],
  "settings.webhooks": [],
};

/** Helpdesk agent: tickets, contacts. */
const agentMatrix: RoleMatrix = {
  contact: READ_WRITE,
  company: READ_ONLY,
  lead: [],
  deal: [],
  pipeline: [],
  invoice: [],
  customer: READ_ONLY,
  product: [],
  project: [],
  task: READ_WRITE,
  ticket: [...READ_WRITE_DELETE, "assign", "send"],
  form: READ_ONLY,
  campaign: [],
  audience: [],
  report: READ_ONLY,
  auditLog: [],
  warehouse: [],
  inventoryItem: [],
  supplier: [],
  purchaseOrder: [],
  expense: READ_WRITE,
  expenseCategory: READ_ONLY,
  employee: READ_ONLY,
  department: READ_ONLY,
  leaveType: READ_ONLY,
  leaveRequest: READ_WRITE,
  signatureEnvelope: READ_WRITE,
  bookingType: READ_WRITE,
  booking: READ_WRITE_DELETE,
  issueProject: READ_ONLY,
  issue: [...READ_WRITE_DELETE, "assign"],
  issueComment: READ_WRITE,
  chatConversation: [...READ_WRITE_DELETE, "assign"],
  chatMessage: [...READ_WRITE, "send"],
  workflow: READ_ONLY,
  workflowEnrollment: READ_ONLY,
  mailThread: READ_WRITE_DELETE,
  mailMessage: [...READ_WRITE, "send"],
  ledgerAccount: [],
  journalEntry: [],
  bankAccount: [],
  bankTransaction: [],
  jobOpening: READ_ONLY,
  candidate: READ_ONLY,
  application: READ_ONLY,
  interview: READ_ONLY,
  "settings.workspace": [],
  "settings.users": [],
  "settings.billing": [],
  "settings.security": [],
  "settings.apiKeys": [],
  "settings.webhooks": [],
};

/** Member: standard contributor across modules. */
const memberMatrix: RoleMatrix = {
  contact: READ_WRITE,
  company: READ_WRITE,
  lead: READ_WRITE,
  deal: READ_WRITE,
  pipeline: READ_ONLY,
  invoice: READ_ONLY,
  customer: READ_ONLY,
  product: READ_ONLY,
  project: READ_WRITE,
  task: READ_WRITE_DELETE,
  ticket: READ_WRITE,
  form: READ_ONLY,
  campaign: READ_ONLY,
  audience: READ_ONLY,
  report: READ_ONLY,
  auditLog: [],
  warehouse: READ_ONLY,
  inventoryItem: READ_WRITE,
  supplier: READ_ONLY,
  purchaseOrder: READ_ONLY,
  expense: READ_WRITE_DELETE,
  expenseCategory: READ_ONLY,
  employee: READ_ONLY,
  department: READ_ONLY,
  leaveType: READ_ONLY,
  leaveRequest: READ_WRITE,
  signatureEnvelope: READ_WRITE,
  bookingType: READ_ONLY,
  booking: READ_WRITE,
  issueProject: READ_WRITE,
  issue: [...READ_WRITE_DELETE, "assign"],
  issueComment: READ_WRITE,
  chatConversation: READ_WRITE,
  chatMessage: [...READ_ONLY, "send"],
  workflow: READ_WRITE,
  workflowEnrollment: READ_WRITE,
  mailThread: READ_WRITE_DELETE,
  mailMessage: [...READ_WRITE, "send"],
  ledgerAccount: READ_ONLY,
  journalEntry: READ_ONLY,
  bankAccount: READ_ONLY,
  bankTransaction: READ_ONLY,
  jobOpening: [...READ_WRITE_DELETE, "manage"],
  candidate: READ_WRITE_DELETE,
  application: [...READ_WRITE_DELETE, "assign", "manage"],
  interview: READ_WRITE_DELETE,
  "settings.workspace": [],
  "settings.users": [],
  "settings.billing": [],
  "settings.security": [],
  "settings.apiKeys": [],
  "settings.webhooks": [],
};

/** Viewer: read-only across the suite. */
const viewerMatrix: RoleMatrix = Object.fromEntries(
  RESOURCES.map((r) => [
    r,
    r.startsWith("settings.") || r === "auditLog" ? [] : READ_ONLY,
  ]),
) as RoleMatrix;

export const ROLE_MATRIX: Record<SystemRole, RoleMatrix> = {
  OWNER: ownerMatrix,
  ADMIN: adminMatrix,
  MANAGER: managerMatrix,
  SALES: salesMatrix,
  FINANCE: financeMatrix,
  AGENT: agentMatrix,
  MEMBER: memberMatrix,
  VIEWER: viewerMatrix,
};

/** Pure check — no side effects, safe to call from anywhere. */
export function can(role: SystemRole, resource: Resource, action: Action): boolean {
  return ROLE_MATRIX[role][resource]?.includes(action) ?? false;
}

export class PermissionError extends Error {
  constructor(public resource: Resource, public action: Action, public role: SystemRole) {
    super(`Forbidden: ${role} cannot ${action} ${resource}`);
    this.name = "PermissionError";
  }
}

/** Throws PermissionError if the role lacks the permission. */
export function assertCan(role: SystemRole, resource: Resource, action: Action): void {
  if (!can(role, resource, action)) {
    throw new PermissionError(resource, action, role);
  }
}
