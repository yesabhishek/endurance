"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { AlertTriangle, ArrowDownRight, BarChart3, Check, Database, Gauge, Layers, Loader2, Newspaper, ShieldAlert, TrendingDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TOOL_TITLES } from "@/lib/ai/tool-titles";
import type { ChatMessage } from "@/lib/chats";
import { cn } from "@/lib/utils";
import { CHAT_SAVED_EVENT, takePendingQuestion } from "./ask";
import { Composer } from "./composer";
import { Markdown } from "./markdown";
import { CitationChip, SourcesPanel, collectSources, type SourceEntry } from "./sources";

export type Suggestion = { title: string; prompt: string; icon: keyof typeof ICONS };

const ICONS = {
  brief: Newspaper,
  concentration: Gauge,
  loss: TrendingDown,
  stress: ShieldAlert,
  sector: Layers,
  history: BarChart3,
};

export type HomeProps = {
  greeting: string;
  summary: ReactNode;
  notice: ReactNode;
  suggestions: Suggestion[];
};

type ChatProps = {
  id: string;
  initialMessages: ChatMessage[];
  ai: { ready: boolean; label: string | null; problem: string | null };
  home?: HomeProps;
};

function readableError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON: a message streamed from the server.
  }
  return error.message || "Something went wrong. Try again.";
}

function textOf(message: ChatMessage) {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function Chat({ id, initialMessages, ai, home }: ChatProps) {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const started = useRef(initialMessages.length > 0);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        // The server keeps the history; send only the new question.
        prepareSendMessagesRequest: ({ id: chatId, messages }) => ({ body: { id: chatId, message: messages.at(-1) } }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop, clearError } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport,
    onFinish: ({ messages: all }) => {
      const first = all.find((message) => message.role === "user");
      window.dispatchEvent(new CustomEvent(CHAT_SAVED_EVENT, { detail: { id, title: first ? textOf(first) : "New chat", updatedAt: new Date().toISOString() } }));
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const sources = useMemo(() => collectSources(messages), [messages]);
  const empty = messages.length === 0;

  function ask(question: string) {
    pinned.current = true;
    if (!started.current) {
      started.current = true;
      // Give the new conversation its own address without reloading the page.
      window.history.replaceState(null, "", `/c/${id}`);
    }
    void sendMessage({ text: question });
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || busy || !ai.ready) return;
    clearError();
    setInput("");
    ask(question);
  }

  // A question handed over from a chart's Ask button.
  useEffect(() => {
    if (!empty || !ai.ready) return;
    const pending = takePendingQuestion();
    if (pending) ask(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the answer as it streams, unless the reader has scrolled up.
  useEffect(() => {
    const element = scroller.current;
    if (element && pinned.current) element.scrollTo({ top: element.scrollHeight });
  }, [messages, status]);

  function onScroll() {
    const element = scroller.current;
    if (element) pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  // The sources panel stays closed until a citation or the Sources button asks for it.
  function selectSource(ref: string | null) {
    setSelected(ref);
    if (ref) setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    if (!panelOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const composerFooter = ai.ready ? (
    <span>
      Answers cite your Kite data · {ai.label}
    </span>
  ) : (
    <span className="text-warn">
      {ai.problem}{" "}
      <Link href="/setup" className="underline underline-offset-2">
        Setup
      </Link>
    </span>
  );

  if (empty && home) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-5 py-12 md:py-16">
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-[2.5rem] leading-[1.1] md:text-[3.25rem]">{home.greeting}</h1>
            <div className="text-[15px] text-muted-foreground">{home.summary}</div>
          </div>
          {home.notice}
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            onStop={() => void stop()}
            busy={busy}
            disabled={!ai.ready}
            placeholder="Ask about your holdings, risk or returns…"
            footer={composerFooter}
            size="large"
            autoFocus
          />
          {home.suggestions.length ? (
            <section aria-label="Suggested questions" className="flex flex-col gap-3">
              <h2 className="eyebrow">Start with</h2>
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {home.suggestions.map((suggestion) => {
                  const Icon = ICONS[suggestion.icon];
                  return (
                    <li key={suggestion.title}>
                      <button
                        type="button"
                        disabled={!ai.ready}
                        onClick={() => send(suggestion.prompt)}
                        className="group flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
                          {suggestion.title}
                        </span>
                        <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{suggestion.prompt}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
        <p className="px-5 pb-6 text-center text-xs text-faint">Endurance reads your data and explains it. It does not give investment advice or predict prices.</p>
      </div>
    );
  }

  const sourceList = [...sources.values()];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Its own row, so the button never sits on top of the answer as it scrolls. */}
        {sourceList.length ? (
          <div className="flex h-11 shrink-0 items-center justify-end px-4">
            {panelOpen ? null : (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                <Database className="size-3.5" aria-hidden /> Sources
                <span className="tabular-nums">{sourceList.length}</span>
              </button>
            )}
          </div>
        ) : null}
        <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto">
          <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-9 px-5 pb-6", sourceList.length ? "pt-4" : "pt-10")}>
            {messages.map((message, index) => (
              <MessageView
                key={message.id}
                message={message}
                sources={sources}
                selected={selected}
                onSelect={selectSource}
                streaming={busy && index === messages.length - 1 && message.role === "assistant"}
              />
            ))}
            {status === "submitted" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Reading your portfolio…
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-loss/25 bg-loss-soft px-4 py-3 text-sm text-loss">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{readableError(error)}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="bg-gradient-to-t from-background from-70% to-transparent px-5 pt-2 pb-5">
          <div className="mx-auto w-full max-w-3xl">
            <Composer
              value={input}
              onChange={setInput}
              onSubmit={() => send(input)}
              onStop={() => void stop()}
              busy={busy}
              disabled={!ai.ready}
              placeholder="Ask a follow-up…"
              footer={composerFooter}
              autoFocus
            />
          </div>
        </div>
      </div>

      {sourceList.length && panelOpen ? (
        <>
          <aside aria-label="Sources" className="hidden w-[380px] shrink-0 border-l bg-card xl:block">
            <SourcesPanel sources={sourceList} selected={selected} onSelect={setSelected} onClose={closePanel} />
          </aside>
          <div className="fixed inset-0 z-40 flex justify-end bg-black/30 xl:hidden" onClick={closePanel}>
            <div className="h-full w-[min(420px,92vw)] bg-card shadow-xl" onClick={(event) => event.stopPropagation()}>
              <SourcesPanel sources={sourceList} selected={selected} onSelect={setSelected} onClose={closePanel} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function stepLabel(name: string, input: unknown) {
  const base = TOOL_TITLES[name] ?? name;
  const args = (input ?? {}) as Record<string, unknown>;
  if (name === "list_holdings") {
    const classes: Record<string, string> = { STOCK: "stocks", MUTUAL_FUND: "mutual funds", ETF: "ETFs", GOLD: "gold" };
    const detail = [args.search, args.sector, typeof args.assetClass === "string" ? classes[args.assetClass] : null].filter(Boolean).join(", ");
    return detail ? `${base}: ${detail}` : base;
  }
  if (name === "what_if" && Array.isArray(args.shocks)) {
    const shocks = (args.shocks as Array<{ scope?: string; match?: string; changePct?: number }>).map(
      (shock) => `${shock.scope === "all" ? "everything" : shock.match} ${typeof shock.changePct === "number" && shock.changePct > 0 ? "+" : "−"}${Math.abs(shock.changePct ?? 0)}%`,
    );
    return `${base}: ${shocks.join(", ")}`;
  }
  if (name === "value_history" && typeof args.days === "number") return `${base}: last ${args.days} days`;
  return base;
}

function MessageView({
  message,
  sources,
  selected,
  onSelect,
  streaming,
}: {
  message: ChatMessage;
  sources: Map<string, SourceEntry>;
  selected: string | null;
  onSelect: (ref: string) => void;
  streaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">{textOf(message)}</div>
      </div>
    );
  }

  const steps = message.parts.filter(isToolUIPart);
  const text = textOf(message);
  const cited = new Set<string>();
  for (const match of text.matchAll(/S\d+/g)) cited.add(match[0]);
  const messageSources = steps
    .map((part) => (part.state === "output-available" ? ((part.output as { source?: { ref?: string } })?.source?.ref ?? null) : null))
    .filter((ref): ref is string => Boolean(ref && sources.has(ref)))
    .map((ref) => sources.get(ref)!);

  return (
    <article className="flex flex-col gap-4">
      {steps.length ? (
        <ol aria-label="What Endurance looked at" className="flex flex-col gap-1.5 border-l pl-4">
          {steps.map((part) => {
            const name = getToolName(part);
            const done = part.state === "output-available";
            const failed = part.state === "output-error";
            return (
              <li key={part.toolCallId} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                {done ? <Check className="size-3.5 text-gain" aria-hidden /> : failed ? <X className="size-3.5 text-loss" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                <span>{stepLabel(name, part.input)}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {text ? (
        <Markdown
          text={text}
          cite={(ref, key) => <CitationChip key={key} refId={ref} source={sources.get(ref)} active={selected === ref} onSelect={onSelect} />}
        />
      ) : null}

      {!streaming && messageSources.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-faint">Sources</span>
          {messageSources.map((source) => (
            <button
              key={source.ref}
              type="button"
              onClick={() => onSelect(source.ref)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
                selected === source.ref && "border-foreground text-foreground",
                !cited.has(source.ref) && "opacity-60",
              )}
            >
              <span className="font-medium tabular-nums">{source.ref.replace(/^S/, "")}</span>
              {source.title}
            </button>
          ))}
          {message.metadata?.model ? <span className="ml-auto text-[11px] text-faint">{message.metadata.model}</span> : null}
        </div>
      ) : null}

      {!streaming && text && !messageSources.length && steps.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-warn">
          <ArrowDownRight className="size-3.5" aria-hidden /> This answer didn&apos;t read any portfolio data.
        </p>
      ) : null}
    </article>
  );
}
