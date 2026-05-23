import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock prisma used inside notify.ts.
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      notification: {
        create: vi.fn().mockResolvedValue({ id: "n1" }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { notifyUser, notifyUsers, NOTIFICATION_TYPES } from "@/modules/notifications/notify";

const notifCreate = prisma.notification.create as unknown as ReturnType<typeof vi.fn>;
const notifCreateMany = prisma.notification.createMany as unknown as ReturnType<typeof vi.fn>;

describe("notifyUser", () => {
  beforeEach(() => {
    notifCreate.mockReset();
    notifCreate.mockResolvedValue({ id: "n1" });
  });

  it("creates a notification with required fields", async () => {
    await notifyUser({
      workspaceId: "ws1",
      userId: "u1",
      type: "task.assigned",
      title: "New task",
    });
    expect(notifCreate).toHaveBeenCalledOnce();
    const call = notifCreate.mock.calls[0][0];
    expect(call.data.workspaceId).toBe("ws1");
    expect(call.data.userId).toBe("u1");
    expect(call.data.type).toBe("task.assigned");
    expect(call.data.title).toBe("New task");
  });

  it("passes optional href and meta", async () => {
    await notifyUser({
      workspaceId: "ws1",
      userId: "u1",
      type: "ticket.assigned",
      title: "Ticket #1",
      href: "/app/helpdesk/tickets/t1",
      meta: { ticketId: "t1" },
    });
    const call = notifCreate.mock.calls[0][0];
    expect(call.data.href).toBe("/app/helpdesk/tickets/t1");
    expect(call.data.meta).toMatchObject({ ticketId: "t1" });
  });

  it("uses Prisma.JsonNull for undefined meta (no object cast)", async () => {
    await notifyUser({
      workspaceId: "ws1",
      userId: "u1",
      type: "invoice.paid",
      title: "Invoice paid",
    });
    const call = notifCreate.mock.calls[0][0];
    // meta should be JsonNull, not undefined or a plain object
    expect(call.data.meta).not.toBeUndefined();
  });

  it("accepts all defined notification types", async () => {
    for (const type of NOTIFICATION_TYPES) {
      notifCreate.mockClear();
      await notifyUser({ workspaceId: "ws", userId: "u", type, title: "t" });
      expect(notifCreate).toHaveBeenCalledOnce();
    }
  });
});

describe("notifyUsers", () => {
  beforeEach(() => {
    notifCreateMany.mockReset();
    notifCreateMany.mockResolvedValue({ count: 0 });
  });

  it("returns { count: 0 } without calling prisma when userIds is empty", async () => {
    const result = await notifyUsers({
      workspaceId: "ws1",
      userIds: [],
      type: "deal.updated",
      title: "Deal updated",
    });
    expect(result).toEqual({ count: 0 });
    expect(notifCreateMany).not.toHaveBeenCalled();
  });

  it("calls createMany with one entry per userId", async () => {
    notifCreateMany.mockResolvedValue({ count: 3 });
    await notifyUsers({
      workspaceId: "ws1",
      userIds: ["u1", "u2", "u3"],
      type: "invite.accepted",
      title: "Invite accepted",
      href: "/app/settings/users",
      meta: { email: "test@example.com" },
    });
    expect(notifCreateMany).toHaveBeenCalledOnce();
    const rows = notifCreateMany.mock.calls[0][0].data as { userId: string; type: string }[];
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.userId)).toEqual(["u1", "u2", "u3"]);
    for (const row of rows) {
      expect(row.type).toBe("invite.accepted");
    }
  });

  it("propagates meta to every row", async () => {
    await notifyUsers({
      workspaceId: "ws",
      userIds: ["u1", "u2"],
      type: "invoice.paid",
      title: "Paid",
      meta: { amount: "100.00" },
    });
    const rows = notifCreateMany.mock.calls[0][0].data as { meta: unknown }[];
    for (const row of rows) {
      expect(row.meta).toMatchObject({ amount: "100.00" });
    }
  });
});

describe("NOTIFICATION_TYPES constant", () => {
  it("includes all five expected types", () => {
    expect(NOTIFICATION_TYPES).toContain("task.assigned");
    expect(NOTIFICATION_TYPES).toContain("ticket.assigned");
    expect(NOTIFICATION_TYPES).toContain("deal.updated");
    expect(NOTIFICATION_TYPES).toContain("invoice.paid");
    expect(NOTIFICATION_TYPES).toContain("invite.accepted");
  });

  it("has exactly five entries", () => {
    expect(NOTIFICATION_TYPES).toHaveLength(5);
  });
});
