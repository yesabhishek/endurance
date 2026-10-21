"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  source: "GMAIL" | "KITE";
  status: "UNREAD" | "READ";
  createdAt: string;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  activeSyncs: ActiveSync[];
};

type ActiveSync = {
  id: string;
  source: "GMAIL" | "KITE";
  status: "QUEUED" | "RUNNING";
  scanned: number;
  inserted: number;
  updated: number;
  startedAt: string;
};

export function NotificationBell() {
  const [data, setData] = useState<NotificationResponse>({ notifications: [], unreadCount: 0, activeSyncs: [] });
  const seenIds = useRef(new Set<string>());
  const initialized = useRef(false);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;

    const next = (await response.json()) as NotificationResponse;
    if (initialized.current) {
      for (const item of next.notifications.toReversed()) {
        if (!seenIds.current.has(item.id) && item.status === "UNREAD") {
          toast(item.title, { description: item.body });
        }
      }
    }

    for (const item of next.notifications) {
      seenIds.current.add(item.id);
    }
    initialized.current = true;
    setData(next);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 10_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  async function markAllRead() {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (response.ok) {
      setData((await response.json()) as NotificationResponse);
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {data.unreadCount > 0 ? (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
              {data.unreadCount > 9 ? "9+" : data.unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-1.5 py-1">
          <DropdownMenuLabel className="px-0 py-0">Notifications</DropdownMenuLabel>
          <Button variant="ghost" size="xs" onClick={markAllRead} disabled={data.unreadCount === 0}>
            <CheckCheck className="size-3" />
            Mark read
          </Button>
        </div>
        <DropdownMenuSeparator />
        {data.activeSyncs.length ? (
          <>
            <div className="px-1.5 py-2">
              <div className="mb-2 text-xs font-medium text-muted-foreground">In progress</div>
              <div className="space-y-2">
                {data.activeSyncs.map((sync) => (
                  <div key={sync.id} className="rounded-lg border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Loader2 className="size-3.5 shrink-0 animate-spin" />
                        <span className="truncate text-sm font-medium">{syncLabel(sync.source)}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{sync.status}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                      <span>scanned {sync.scanned}</span>
                      <span>new {sync.inserted}</span>
                      <span>updated {sync.updated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {data.notifications.length ? (
          data.notifications.map((item) => (
            <DropdownMenuItem key={item.id} className="block whitespace-normal py-2" disabled>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    item.status === "UNREAD" ? "bg-primary" : "bg-transparent",
                  )}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{item.body}</div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                {new Intl.DateTimeFormat("en-IN", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(item.createdAt))}
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-1.5 py-3 text-sm text-muted-foreground">No notifications yet.</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function syncLabel(source: ActiveSync["source"]) {
  return source === "GMAIL" ? "Expenses via email" : "Investments via Zerodha Account";
}
