import "server-only";
import { publish, type RealtimeEvent } from "@/platform/realtime";
import type { NotificationType } from "./notify";

/**
 * Push a freshly persisted Notification onto the realtime hub so the user's
 * SSE bell + toast layer updates without polling. Composes with `notifyUser`
 * / `notifyUsers` from `notify.ts` — call this immediately after the DB
 * insert returns so the published payload reflects the stored row.
 *
 * Channel: `ws:<workspaceId>:notifications:<userId>` — per-user fan-out so
 * each subscriber gets only their own events.
 */

export type NotificationEventData = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
};

export function notificationChannelKey(workspaceId: string, userId: string): string {
  return `ws:${workspaceId}:notifications:${userId}`;
}

export function buildNotificationEvent(input: {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  createdAt: Date;
}): Omit<RealtimeEvent, "id"> {
  const data: NotificationEventData = {
    id: input.id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    createdAt: input.createdAt.toISOString(),
  };
  return { type: "notification.created", data };
}

export function buildUnreadCountEvent(unread: number): Omit<RealtimeEvent, "id"> {
  return { type: "notification.unread", data: { unread } };
}

export function publishNotification(
  workspaceId: string,
  userId: string,
  notification: Parameters<typeof buildNotificationEvent>[0],
): void {
  publish(notificationChannelKey(workspaceId, userId), buildNotificationEvent(notification));
}

export function publishUnreadCount(
  workspaceId: string,
  userId: string,
  unread: number,
): void {
  publish(notificationChannelKey(workspaceId, userId), buildUnreadCountEvent(unread));
}

/**
 * Fan-out helper: publish the same notification to many users at once. Useful
 * after a `notifyUsers` batch insert when you don't want to emit per-row.
 */
export function publishNotificationToUsers(
  workspaceId: string,
  userIds: string[],
  notification: Parameters<typeof buildNotificationEvent>[0],
): void {
  const event = buildNotificationEvent(notification);
  for (const uid of userIds) {
    publish(notificationChannelKey(workspaceId, uid), event);
  }
}
