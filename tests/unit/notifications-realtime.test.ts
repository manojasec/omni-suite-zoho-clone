import { describe, it, expect } from "vitest";
import {
  buildNotificationEvent,
  buildUnreadCountEvent,
  notificationChannelKey,
  publishNotification,
  publishNotificationToUsers,
  publishUnreadCount,
} from "@/modules/notifications/realtime";
import { subscribe, type RealtimeEvent } from "@/platform/realtime";

describe("notifications realtime", () => {
  it("channel key is per-user", () => {
    expect(notificationChannelKey("ws1", "u1")).toBe("ws:ws1:notifications:u1");
  });

  it("buildNotificationEvent fills nullable fields and ISO timestamp", () => {
    const ev = buildNotificationEvent({
      id: "n1",
      type: "task.assigned",
      title: "New task",
      createdAt: new Date("2026-05-09T10:00:00Z"),
    });
    expect(ev.type).toBe("notification.created");
    expect(ev.data).toMatchObject({
      id: "n1",
      type: "task.assigned",
      title: "New task",
      body: null,
      href: null,
      createdAt: "2026-05-09T10:00:00.000Z",
    });
  });

  it("publishNotification fans out to one user only", () => {
    const seenA: RealtimeEvent[] = [];
    const seenB: RealtimeEvent[] = [];
    const offA = subscribe("ws:w1:notifications:userA", (e) => seenA.push(e));
    const offB = subscribe("ws:w1:notifications:userB", (e) => seenB.push(e));
    publishNotification("w1", "userA", {
      id: "n2",
      type: "ticket.assigned",
      title: "Ticket",
      createdAt: new Date(),
    });
    offA();
    offB();
    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(0);
  });

  it("publishUnreadCount emits a notification.unread event with count", () => {
    const seen: RealtimeEvent[] = [];
    const off = subscribe("ws:w2:notifications:u1", (e) => seen.push(e));
    publishUnreadCount("w2", "u1", 7);
    off();
    expect(seen[0]?.type).toBe("notification.unread");
    expect((seen[0]?.data as { unread: number }).unread).toBe(7);
  });

  it("publishNotificationToUsers fans out to many user channels", () => {
    const seenA: RealtimeEvent[] = [];
    const seenB: RealtimeEvent[] = [];
    const offA = subscribe("ws:w3:notifications:a", (e) => seenA.push(e));
    const offB = subscribe("ws:w3:notifications:b", (e) => seenB.push(e));
    publishNotificationToUsers("w3", ["a", "b"], {
      id: "n3",
      type: "deal.updated",
      title: "Deal",
      createdAt: new Date(),
    });
    offA();
    offB();
    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(1);
  });

  it("buildUnreadCountEvent payload is just {unread}", () => {
    const ev = buildUnreadCountEvent(0);
    expect(ev.data).toEqual({ unread: 0 });
  });
});
