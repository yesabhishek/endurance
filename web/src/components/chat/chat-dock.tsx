"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Maximize2, MessageSquarePlus, Sparkles, X } from "lucide-react";
import { FinanceChat } from "@/components/chat/finance-chat";
import { cn } from "@/lib/utils";

export type DockChatSettings = {
  ready: boolean;
  consentGiven: boolean;
  providerLabel: string | null;
  model: string | null;
  suggestions: string[];
};

type DockContext = {
  open: boolean;
  /** False on pages that are themselves the chat. */
  available: boolean;
  toggle: (next?: boolean) => void;
  /** Opens the dock and asks the question in the current conversation. */
  ask: (question: string) => void;
};

type PanelState = {
  settings: DockChatSettings;
  pending: { id: number; text: string } | null;
  focusSignal: number;
  session: number;
  threadId: string | null;
  setThreadId: (id: string | null) => void;
  reset: () => void;
};

const PanelContext = createContext<PanelState | null>(null);

const Context = createContext<DockContext | null>(null);
const STORAGE_KEY = "endurance:chat-dock";

export function useChatDock() {
  const value = useContext(Context);
  if (!value) throw new Error("useChatDock must be used inside ChatDockProvider");
  return value;
}

function readStoredOpen() {
  // Below 1280px the dock is an overlay, so it always starts closed there.
  if (!window.matchMedia("(min-width: 1280px)").matches) return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "open") return true;
    if (stored === "closed") return false;
  } catch {
    // Storage can be blocked; fall back to the screen-size default.
  }
  return true;
}

function storeOpen(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "open" : "closed");
  } catch {
    // Best effort.
  }
}

export function ChatDockProvider({ settings, children }: { settings: DockChatSettings; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const available = !pathname.startsWith("/chat");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ id: number; text: string } | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [session, setSession] = useState(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const counter = useRef(0);
  const openRef = useRef(false);

  const setOpenValue = useCallback((value: boolean, remember = true) => {
    openRef.current = value;
    setOpen(value);
    if (remember) storeOpen(value);
    if (value) setFocusSignal((n) => n + 1);
  }, []);

  // Restore the reader's last choice after hydration; wide screens open by default.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = readStoredOpen();
      openRef.current = value;
      setOpen(value);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = useCallback((next?: boolean) => setOpenValue(next ?? !openRef.current), [setOpenValue]);

  const ask = useCallback(
    (question: string) => {
      if (!available) {
        router.push(`/chat?q=${encodeURIComponent(question)}`);
        return;
      }
      counter.current += 1;
      setPending({ id: counter.current, text: question });
      setOpenValue(true);
    },
    [available, router, setOpenValue],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (available) toggle(true);
        else document.getElementById("chat-input")?.focus();
      } else if (event.key === "/" && !typing && available) {
        event.preventDefault();
        toggle(true);
      } else if (event.key === "Escape" && openRef.current && window.matchMedia("(max-width: 1279px)").matches) {
        toggle(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [available, toggle]);

  const value = useMemo(() => ({ open: open && available, available, toggle, ask }), [open, available, toggle, ask]);
  const panel = useMemo<PanelState>(
    () => ({
      settings,
      pending,
      focusSignal,
      session,
      threadId,
      setThreadId,
      reset: () => {
        setSession((n) => n + 1);
        setThreadId(null);
        setPending(null);
        setFocusSignal((n) => n + 1);
      },
    }),
    [settings, pending, focusSignal, session, threadId],
  );

  return (
    <Context.Provider value={value}>
      <PanelContext.Provider value={panel}>
        {children}
        {available && !open ? <AskFab /> : null}
      </PanelContext.Provider>
    </Context.Provider>
  );
}

/**
 * The dock itself. Docked beside the page on wide screens, a slide-over panel
 * below 1280px. Stays mounted while closed so the conversation survives.
 */
export function ChatDockPanel() {
  const { open, available, toggle } = useChatDock();
  const panel = useContext(PanelContext);
  if (!available || !panel) return null;
  const { settings } = panel;

  return (
    <>
      <div aria-hidden onClick={() => toggle(false)} className={cn("fixed inset-0 z-40 bg-black/30 xl:hidden", !open && "hidden")} />
      <aside
        aria-label="Ask Endurance"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col border-l bg-card shadow-2xl",
          "xl:sticky xl:top-14 xl:z-auto xl:h-[calc(100dvh-3.5rem)] xl:w-[25rem] xl:max-w-none xl:shrink-0 xl:shadow-none",
          !open && "hidden",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Sparkles className="size-4 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Ask Endurance</div>
            <div className="truncate text-xs text-muted-foreground">{settings.ready ? `Reads your synced portfolio with ${settings.model}` : "Needs an AI key"}</div>
          </div>
          <button
            type="button"
            onClick={panel.reset}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="New conversation"
            title="New conversation"
          >
            <MessageSquarePlus className="size-4" aria-hidden />
          </button>
          <Link
            href={panel.threadId ? `/chat?thread=${panel.threadId}` : "/chat"}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open full view with history"
            title="Full view and history"
          >
            <Maximize2 className="size-4" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => toggle(false)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            title="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <FinanceChat
          key={panel.session}
          variant="dock"
          threadId={null}
          initialMessages={[]}
          ready={settings.ready}
          consentGiven={settings.consentGiven}
          providerLabel={settings.providerLabel}
          model={settings.model}
          initialQuestion={null}
          suggestions={settings.suggestions}
          pending={panel.pending}
          focusSignal={panel.focusSignal}
          onThreadChange={panel.setThreadId}
        />
      </aside>
    </>
  );
}

/** The header's search-style trigger. */
export function AskBar() {
  const { available, toggle } = useChatDock();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={() => toggle()}
      className="hidden h-9 w-full max-w-[22rem] items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground md:flex"
    >
      <Sparkles className="size-4 shrink-0 text-brand" aria-hidden />
      <span className="flex-1 truncate">Ask anything about your portfolio</span>
      <kbd className="rounded border bg-card px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">⌘K</kbd>
    </button>
  );
}

function AskFab() {
  const { toggle } = useChatDock();
  return (
    <button
      type="button"
      onClick={() => toggle(true)}
      className="fixed right-4 bottom-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5 md:right-6 md:bottom-6"
    >
      <Sparkles className="size-4" aria-hidden />
      Ask Endurance
    </button>
  );
}

/** A small "Ask" action for a chart or panel, carrying a question about what it shows. */
export function AskButton({ question, label = "Ask", className }: { question: string; label?: string; className?: string }) {
  const { ask } = useChatDock();
  return (
    <button
      type="button"
      onClick={() => ask(question)}
      title={question}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-accent",
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
