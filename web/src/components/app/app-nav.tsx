"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Command, CreditCard, Landmark, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: BarChart3 },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/investments", label: "Investments", icon: Landmark },
  { href: "/chat", label: "Chat", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <Command className="size-4" />
          Endurance
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <NotificationBell />
        <div className="hidden text-xs text-muted-foreground md:block">Powered by Zerodha & GMail</div>
      </div>
    </header>
  );
}
