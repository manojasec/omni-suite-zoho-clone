import "server-only";
import { publish, type RealtimeEvent } from "@/platform/realtime";

/**
 * Helpdesk realtime events. Mirrors `cliq/realtime.ts`: pure builders + thin
 * `publish*` wrappers. Used by ticket actions to push live updates to anyone
 * viewing a ticket — agents, supervisors, even the requester via the public
 * portal subscription.
 *
 * Channels:
 *   - `ws:<workspaceId>:helpdesk:ticket:<ticketId>` — single-ticket detail view
 *   - `ws:<workspaceId>:helpdesk:queue`            — list/queue dashboards
 */

export type TicketStatus = "OPEN" | "PENDING" | "ON_HOLD" | "RESOLVED" | "CLOSED";

export type TicketUpdateEventData = {
  ticketId: string;
  fields: Partial<{
    status: TicketStatus;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assigneeId: string | null;
    firstResponseAt: string | null;
    resolvedAt: string | null;
  }>;
  updatedAt: string;
};

export type TicketMessageEventData = {
  ticketId: string;
  messageId: string;
  authorType: "agent" | "contact";
  authorId: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

export function ticketChannelKey(workspaceId: string, ticketId: string): string {
  return `ws:${workspaceId}:helpdesk:ticket:${ticketId}`;
}

export function helpdeskQueueKey(workspaceId: string): string {
  return `ws:${workspaceId}:helpdesk:queue`;
}

export function buildTicketUpdateEvent(
  input: { ticketId: string; updatedAt: Date } & TicketUpdateEventData["fields"],
): Omit<RealtimeEvent, "id"> {
  const fields: TicketUpdateEventData["fields"] = {};
  if (input.status !== undefined) fields.status = input.status;
  if (input.priority !== undefined) fields.priority = input.priority;
  if (input.assigneeId !== undefined) fields.assigneeId = input.assigneeId;
  if (input.firstResponseAt !== undefined) {
    fields.firstResponseAt = input.firstResponseAt
      ? toIso(input.firstResponseAt)
      : null;
  }
  if (input.resolvedAt !== undefined) {
    fields.resolvedAt = input.resolvedAt ? toIso(input.resolvedAt) : null;
  }
  return {
    type: "helpdesk.ticket.updated",
    data: {
      ticketId: input.ticketId,
      fields,
      updatedAt: input.updatedAt.toISOString(),
    } satisfies TicketUpdateEventData,
  };
}

export function buildTicketMessageEvent(input: {
  ticketId: string;
  messageId: string;
  authorType: "agent" | "contact";
  authorId?: string | null;
  body: string;
  isInternal: boolean;
  createdAt: Date;
}): Omit<RealtimeEvent, "id"> {
  const data: TicketMessageEventData = {
    ticketId: input.ticketId,
    messageId: input.messageId,
    authorType: input.authorType,
    authorId: input.authorId ?? null,
    body: input.body,
    isInternal: input.isInternal,
    createdAt: input.createdAt.toISOString(),
  };
  return { type: "helpdesk.ticket.message.created", data };
}

function toIso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

export function publishTicketUpdate(
  workspaceId: string,
  input: Parameters<typeof buildTicketUpdateEvent>[0],
): void {
  const event = buildTicketUpdateEvent(input);
  publish(ticketChannelKey(workspaceId, input.ticketId), event);
  publish(helpdeskQueueKey(workspaceId), event);
}

export function publishTicketMessage(
  workspaceId: string,
  input: Parameters<typeof buildTicketMessageEvent>[0],
): void {
  publish(
    ticketChannelKey(workspaceId, input.ticketId),
    buildTicketMessageEvent(input),
  );
}
