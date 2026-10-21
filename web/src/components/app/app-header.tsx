"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { BrandLockup } from "@/components/app/brand";
import { NotificationBell } from "@/components/app/notification-bell";
import { AskBar, useChatDock } from "@/components/chat/chat-dock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Kite's own words for the places people already know.
const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/investments", label: "Holdings" },
  { href: "/expenses", label: "Spending" },
  { href: "/chat", label: "Ask" },
  { href: "/settings", label: "Settings" },
];

export type KiteStatus = { tone: "ok" | "warn" | "off"; label: string; clientId: string | null };

type AppHeaderProps = {
  user: { email: string; name: string | null };
  kite: KiteStatus;
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AppHeader({ user, kite }: AppHeaderProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { available, toggle } = useChatDock();

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-ring" aria-label="Endurance dashboard">
          <BrandLockup />
        </Link>

        <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  active && "font-medium text-brand hover:text-brand",
                )}
              >
                {item.label}
                {active ? <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-brand" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <AskBar />
          {available ? (
            <button
              type="button"
              onClick={() => toggle()}
              aria-label="Ask Endurance"
              className="grid size-9 place-items-center rounded-md text-brand hover:bg-accent md:hidden"
            >
              <Sparkles className="size-4" aria-hidden />
            </button>
          ) : null}

          <Link
            href="/settings#kite"
            title={kite.label}
            className="hidden h-8 items-center gap-2 rounded-md border px-2.5 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <span
              aria-hidden
              className={cn("size-1.5 rounded-full", kite.tone === "ok" ? "bg-gain" : kite.tone === "warn" ? "bg-warn" : "bg-faint")}
            />
            <span className="font-medium text-foreground">Kite</span>
            <span>{kite.clientId ?? (kite.tone === "off" ? "Not connected" : "")}</span>
            {kite.tone === "warn" ? <span className="text-warn">Log in</span> : null}
          </Link>

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Account"
            >
              {initials(user.name, user.email)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">{user.name ?? user.email}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                {kite.clientId ? <span className="text-xs font-normal text-muted-foreground">Kite client ID {kite.clientId}</span> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="size-4" aria-hidden /> System
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">
                  <Sun className="size-4" aria-hidden /> Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="size-4" aria-hidden /> Dark
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <form action="/api/auth/logout" method="post">
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full">
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav aria-label="Main" className="flex gap-1 overflow-x-auto border-t px-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm text-muted-foreground", active && "border-brand font-medium text-brand")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
