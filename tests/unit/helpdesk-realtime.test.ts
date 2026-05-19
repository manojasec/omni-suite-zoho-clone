import { describe, it, expect } from "vitest";
import {
  buildTicketMessageEvent,
  buildTicketUpdateEvent,
  helpdeskQueueKey,
  publishTicketMessage,
  publishTicketUpdate,
  ticketChannelKey,
} from "@/modules/helpdesk/realtime";
import { subscribe, type RealtimeEvent } from "@/platform/realtime";

describe("helpdesk realtime — channel keys", () => {
  it("scopes per-ticket and queue channels", () => {
    expect(ticketChannelKey("w1", "t1")).toBe("ws:w1:helpdesk:ticket:t1");
    expect(helpdeskQueueKey("w1")).toBe("ws:w1:helpdesk:queue");
  });
});

describe("helpdesk realtime — ticket update event", () => {
  it("only includes fields explicitly provided", () => {
    const ev = buildTicketUpdateEvent({
      ticketId: "t1",
      status: "RESOLVED",
      updatedAt: new Date("2026-05-09T10:00:00Z"),
    });
    expect(ev.type).toBe("helpdesk.ticket.updated");
    const data = ev.data as { fields: Record<string, unknown> };
    expect(data.fields).toEqual({ status: "RESOLVED" });
  });

  it("serialises Date fields to ISO and preserves explicit nulls", () => {
    const ev = buildTicketUpdateEvent({
      ticketId: "t1",
      assigneeId: null,
      firstResponseAt: new Date("2026-05-09T10:00:00Z"),
      resolvedAt: null,
      updatedAt: new Date("2026-05-09T10:01:00Z"),
    });
    const data = ev.data as { fields: Record<string, unknown> };
    expect(data.fields.assigneeId).toBeNull();
    expect(data.fields.firstResponseAt).toBe("2026-05-09T10:00:00.000Z");
    expect(data.fields.resolvedAt).toBeNull();
  });

  it("publishTicketUpdate fans out to ticket channel AND queue channel", () => {
    const ticketSeen: RealtimeEvent[] = [];
    const queueSeen: RealtimeEvent[] = [];
    const offA = subscribe("ws:wsZ:helpdesk:ticket:tZ", (e) => ticketSeen.push(e));
    const offB = subscribe("ws:wsZ:helpdesk:queue", (e) => queueSeen.push(e));
    publishTicketUpdate("wsZ", {
      ticketId: "tZ",
      status: "OPEN",
      updatedAt: new Date(),
    });
    offA();
    offB();
    expect(ticketSeen).toHaveLength(1);
    expect(queueSeen).toHaveLength(1);
  });
});

describe("helpdesk realtime — ticket message event", () => {
  it("includes isInternal + authorType", () => {
    const ev = buildTicketMessageEvent({
      ticketId: "t1",
      messageId: "m1",
      authorType: "agent",
      authorId: "u1",
      body: "Working on it",
      isInternal: true,
      createdAt: new Date("2026-05-09T11:00:00Z"),
    });
    expect(ev.type).toBe("helpdesk.ticket.message.created");
    expect(ev.data).toMatchObject({
      ticketId: "t1",
      messageId: "m1",
      authorType: "agent",
      isInternal: true,
      createdAt: "2026-05-09T11:00:00.000Z",
    });
  });

  it("publishTicketMessage delivers only to per-ticket channel", () => {
    const ticketSeen: RealtimeEvent[] = [];
    const queueSeen: RealtimeEvent[] = [];
    const offA = subscribe("ws:wsQ:helpdesk:ticket:tQ", (e) => ticketSeen.push(e));
    const offB = subscribe("ws:wsQ:helpdesk:queue", (e) => queueSeen.push(e));
    publishTicketMessage("wsQ", {
      ticketId: "tQ",
      messageId: "mQ",
      authorType: "contact",
      body: "Replied",
      isInternal: false,
      createdAt: new Date(),
    });
    offA();
    offB();
    expect(ticketSeen).toHaveLength(1);
    expect(queueSeen).toHaveLength(0);
  });
});
