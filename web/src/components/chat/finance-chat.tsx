"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName, type UIMessage } from "ai";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Check, Database, Loader2, ShieldCheck, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { TOOL_LABELS } from "@/lib/ai/tool-labels";
import { cn } from "@/lib/utils";

type Metadata = { threadId?: string; model?: string; tools?: string[] };
export type ChatMessage = UIMessage<Metadata>;

type FinanceChatProps = {
  threadId: string | null;
  initialMessages: ChatMessage[];
  ready: boolean;
  consentGiven: boolean;
  providerLabel: string | null;
  model: string | null;
  initialQuestion: string | null;
  /** "page" fills the Ask page; "dock" fits the side panel and scrolls inside it. */
  variant?: "page" | "dock";
  suggestions?: string[];
  /** A question sent from elsewhere (a chart's Ask button). Sent once per id. */
  pending?: { id: number; text: string } | null;
  /** Focuses the composer whenever this number changes. */
  focusSignal?: number;
  onThreadChange?: (threadId: string) => void;
};

export function FinanceChat({
  threadId,
  initialMessages,
  ready,
  consentGiven,
  providerLabel,
  model,
  initialQuestion,
  variant = "page",
  suggestions = [],
  pending = null,
  focusSignal = 0,
  onThreadChange,
}: FinanceChatProps) {
  const dock = variant === "dock";
  const threadRef = useRef<string | null>(threadId);
  const [consent, setConsent] = useState(consentGiven);
  const [input, setInput] = useState("");
  const askedInitial = useRef(false);
  const sentPending = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        // The server keeps the history; send only the new question and the thread it belongs to.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages.at(-1);
          const text = last?.parts.map((part) => (part.type === "text" ? part.text : "")).join("") ?? "";
          return { body: { threadId: (body?.threadId as string | null | undefined) ?? null, text } };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop, clearError } = useChat<ChatMessage>({
    id: threadId ?? undefined,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      const id = message.metadata?.threadId;
      if (id && threadRef.current !== id) {
        threadRef.current = id;
        onThreadChange?.(id);
        if (!dock) window.history.replaceState(null, "", `/chat?thread=${id}`);
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (dock) {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, status, dock]);

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (initialQuestion && ready && consent && !askedInitial.current && messages.length === 0) {
      askedInitial.current = true;
      void sendMessage({ text: initialQuestion }, { body: { threadId: threadRef.current } });
    }
  }, [initialQuestion, ready, consent, messages.length, sendMessage]);

  useEffect(() => {
    if (!pending || !ready || !consent || busy || sentPending.current === pending.id) return;
    sentPending.current = pending.id;
    clearError();
    void sendMessage({ text: pending.text }, { body: { threadId: threadRef.current } });
  }, [pending, ready, consent, busy, sendMessage, clearError]);

  async function allow() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiDataConsent: true }),
    });
    if (response.ok) setConsent(true);
    else toast.error("Couldn't save your choice. Try again.");
  }

  function send(text: string) {
    if (!text || busy) return;
    clearError();
    setInput("");
    void sendMessage({ text }, { body: { threadId: threadRef.current } });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input.trim());
  }

  if (!ready) {
    return (
      <div className={cn("flex flex-col items-start gap-3", dock ? "p-5" : "rounded-lg border border-dashed p-8")}>
        <h2 className="font-display text-lg">Chat needs an AI key</h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          Add a key for OpenAI, Anthropic, Google or Vercel AI Gateway and pick a model. You pay your provider directly; Endurance never sees a bill.
        </p>
        <Link href="/settings#ai" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Add a key <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  const empty = messages.length === 0 && !busy;

  return (
    <div className={cn("flex flex-col", dock ? "min-h-0 flex-1" : "min-h-[calc(100dvh-12rem)] gap-4")}>
      <div ref={scrollerRef} className={cn("flex-1 space-y-6", dock && "overflow-y-auto overscroll-contain px-4 py-5")} aria-live="polite">
        {empty ? (
          <div className={cn("flex flex-col gap-4", dock ? "pt-2" : "py-6")}>
            <div className="flex flex-col gap-1.5">
              <h2 className={cn("font-display", dock ? "text-lg" : "text-2xl")}>What would you like to know?</h2>
              <p className="text-sm text-muted-foreground">
                Answers come from your synced holdings, risk checks and projections, and say how fresh the data is.
              </p>
            </div>
            {suggestions.length && consent ? (
              <ul className={cn("flex gap-2", dock ? "flex-col" : "flex-wrap")}>
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => send(suggestion)}
                      className={cn(
                        "flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-brand hover:bg-accent",
                        dock && "w-full",
                      )}
                    >
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}

        {status === "submitted" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Reading your data…
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-loss-soft px-3 py-2 text-sm text-loss">
            {readableError(error)}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {!consent ? (
        <div className={cn("flex flex-col gap-3 border bg-card p-4", dock ? "m-3 rounded-lg" : "rounded-lg")}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> Before your first question
          </div>
          <p className="text-sm text-muted-foreground">
            To answer, Endurance sends only the figures a question needs (such as holdings, values and sectors) to {providerLabel ?? "your AI provider"} using your key. Your Kite login, API keys
            and password never leave this server. You can delete chat history any time in Settings.
          </p>
          <button type="button" onClick={allow} className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            I understand, continue
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className={cn("flex flex-col gap-2", dock ? "border-t bg-card p-3" : "sticky bottom-4")}>
          <div className="flex items-end gap-2 rounded-lg border border-input bg-card py-1.5 pr-1.5 pl-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/25">
            <label htmlFor="chat-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask about your portfolio…"
              className="field-sizing-content max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            {busy ? (
              <button type="button" onClick={() => void stop()} aria-label="Stop" className="grid size-9 shrink-0 place-items-center rounded-md border">
                <Square className="size-3.5" aria-hidden />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send" className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40">
                <ArrowUp className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {providerLabel} {model} · Read-only analysis, not investment advice.
          </p>
        </form>
      )}
    </div>
  );
}

function readableError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // Not JSON; fall through.
  }
  return error.message || "Something went wrong. Try again.";
}

function MessageView({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-accent px-3.5 py-2 text-sm text-accent-foreground">{text}</div>
      </div>
    );
  }

  const tools = message.parts.filter(isToolUIPart);
  const savedTools = message.metadata?.tools ?? [];
  const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

  return (
    <div className="flex flex-col gap-3">
      {tools.length || savedTools.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tools.map((part) => {
            const name = getToolName(part);
            const done = part.state === "output-available";
            return (
              <span key={part.toolCallId} className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {done ? <Check className="size-3" aria-hidden /> : part.state === "output-error" ? <Database className="size-3 text-loss" aria-hidden /> : <Loader2 className="size-3 animate-spin" aria-hidden />}
                {TOOL_LABELS[name] ?? name}
              </span>
            );
          })}
          {!tools.length
            ? savedTools.map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Database className="size-3" aria-hidden />
                  {label}
                </span>
              ))
            : null}
        </div>
      ) : null}
      {text ? <SafeText text={text} /> : null}
    </div>
  );
}

/**
 * Renders model output as text with light formatting: paragraphs, bullet lists,
 * **bold** and tables. It never renders links or images, so model output can't
 * make the browser load an attacker's URL.
 */
function SafeText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="flex max-w-3xl flex-col gap-3 text-sm leading-6">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*\|.*\|\s*$/.test(line))) {
          return <TextTable key={index} lines={lines} />;
        }
        if (lines.every((line) => /^\s*([-*•]|\d+\.)\s+/.test(line))) {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        if (/^#{1,4}\s/.test(block)) {
          return (
            <h3 key={index} className="font-display text-base">
              {inline(block.replace(/^#{1,4}\s/, ""))}
            </h3>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((piece, i) =>
    piece.startsWith("**") && piece.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {piece.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{piece.replace(/`([^`]+)`/g, "$1")}</Fragment>
    ),
  );
}

function TextTable({ lines }: { lines: string[] }) {
  const rows = lines
    // Drop the |---|:---:| separator row.
    .filter((line) => !/^[\s|:-]+$/.test(line))
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const [head, ...body] = rows;
  if (!head) return null;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((cell, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {inline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b last:border-0">
              {row.map((cell, c) => (
                <td key={c} className={cn("px-3 py-2", c > 0 && /^[−\-+₹\d]/.test(cell) && "text-right")}>
                  {inline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
