"use client";

import { LineChart, Menu, MessageSquareText, Plus, Settings2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CHAT_SAVED_EVENT } from "@/components/chat/ask";
import { cn } from "@/lib/utils";

export type ShellChat = { id: string; title: string; updatedAt: string };

export type ShellStatus = {
  kite: { tone: "ok" | "warn" | "off" | "demo"; label: string; detail: string | null };
  ai: { ready: boolean; label: string };
};

const NAV = [
  { href: "/", label: "Assistant", icon: MessageSquareText },
  { href: "/portfolio", label: "Portfolio", icon: LineChart },
  { href: "/setup", label: "Setup", icon: Settings2 },
];

const short = (title: string) => (title.length > 60 ? `${title.slice(0, 58)}…` : title);

function Sidebar({ chats, status, onNavigate }: { chats: ShellChat[]; status: ShellStatus; onNavigate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [list, setList] = useState(chats);
  const [seen, setSeen] = useState(chats);
  // A server render brought a fresh list (after a navigation or refresh): start from it.
  if (chats !== seen) {
    setSeen(chats);
    setList(chats);
  }

  useEffect(() => {
    function onSaved(event: Event) {
      const detail = (event as CustomEvent<ShellChat>).detail;
      setList((current) => {
        const existing = current.find((chat) => chat.id === detail.id);
        const entry = { ...detail, title: existing?.title ?? short(detail.title) };
        return [entry, ...current.filter((chat) => chat.id !== detail.id)];
      });
    }
    window.addEventListener(CHAT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(CHAT_SAVED_EVENT, onSaved);
  }, []);

  async function remove(chat: ShellChat) {
    if (!window.confirm(`Delete "${chat.title}"? This can't be undone.`)) return;
    const response = await fetch(`/api/chat/${chat.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setList((current) => current.filter((entry) => entry.id !== chat.id));
    if (pathname === `/c/${chat.id}`) router.push("/");
  }

  const dot = { ok: "bg-gain", warn: "bg-warn", off: "bg-sidebar-muted", demo: "bg-chart-4" }[status.kite.tone];

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} className="font-display text-[1.6rem] leading-none tracking-tight">
          Endurance
        </Link>
      </div>

      <div className="px-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2.5 rounded-md border border-sidebar-border px-3 text-[13px] font-medium transition-colors hover:bg-sidebar-accent"
        >
          <Plus className="size-4" aria-hidden /> New chat
        </Link>
      </div>

      <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/c/") : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                active && "bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <h2 className="px-6 pb-2 text-[11px] font-medium tracking-wide text-sidebar-muted uppercase">Recent</h2>
        {list.length ? (
          <ul className="flex-1 overflow-y-auto px-3 pb-3">
            {list.map((chat) => {
              const active = pathname === `/c/${chat.id}`;
              return (
                <li key={chat.id} className="group relative">
                  <Link
                    href={`/c/${chat.id}`}
                    onClick={onNavigate}
                    title={chat.title}
                    className={cn(
                      "block truncate rounded-md py-1.5 pr-8 pl-3 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      active && "bg-sidebar-accent text-sidebar-foreground",
                    )}
                  >
                    {chat.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(chat)}
                    aria-label={`Delete ${chat.title}`}
                    className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-sidebar-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-sidebar-foreground focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 text-[13px] text-sidebar-muted">Your conversations will appear here.</p>
        )}
      </div>

      <Link href="/setup" onClick={onNavigate} className="mx-3 mb-3 flex flex-col gap-1.5 rounded-md border border-sidebar-border px-3 py-2.5 text-xs transition-colors hover:bg-sidebar-accent">
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
          <span className="font-medium">{status.kite.label}</span>
        </span>
        {status.kite.detail ? <span className="pl-3.5 text-sidebar-muted">{status.kite.detail}</span> : null}
        <span className="flex items-center gap-2">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", status.ai.ready ? "bg-gain" : "bg-warn")} />
          <span className="truncate text-sidebar-muted">{status.ai.label}</span>
        </span>
      </Link>
    </div>
  );
}

export function AppShell({ chats, status, children }: { chats: ShellChat[]; status: ShellStatus; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  // Close the mobile menu whenever the page changes, including back and forward.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-64 shrink-0 md:block">
        <Sidebar chats={chats} status={status} onNavigate={() => undefined} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 flex bg-black/40 md:hidden" onClick={() => setOpen(false)}>
          <div className="relative h-full w-72 max-w-[85vw]" onClick={(event) => event.stopPropagation()}>
            <Sidebar chats={chats} status={status} onNavigate={() => setOpen(false)} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 grid size-8 place-items-center rounded-md text-sidebar-muted hover:text-sidebar-foreground">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4 md:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-8 place-items-center rounded-md hover:bg-accent">
            <Menu className="size-4" aria-hidden />
          </button>
          <Link href="/" className="font-display text-xl">
            Endurance
          </Link>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
