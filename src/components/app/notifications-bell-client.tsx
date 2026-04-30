"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationsBellClient({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;
    let es: EventSource | null = null;
    let cancelled = false;

    const open = () => {
      if (cancelled) return;
      es = new EventSource("/api/notifications/stream");
      es.addEventListener("count", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { unread: number };
          setUnread(data.unread);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        es?.close();
        if (!cancelled) setTimeout(open, 3000);
      };
    };
    open();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  return (
    <Link
      href="/app/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-accent"
      aria-label={`Notifications (${unread} unread)`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
