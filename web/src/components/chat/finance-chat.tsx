"use client";

import { FormEvent, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SCOPES = ["@expenses", "@investments", "@records", "@portfolio", "@market"];

export function FinanceChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Ask with @expenses, @investments, @records, @portfolio, or @market. I can analyze your data read-only and cite the source records I used.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isStreaming) return;

    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value);
        setMessages([...nextMessages, { role: "assistant", content: assistant }]);
      }
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Chat failed.",
        },
      ]);
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function insertScope(scope: string) {
    setInput((value) => `${scope} ${value}`.trimEnd());
    textareaRef.current?.focus();
  }

  return (
    <div className="grid min-h-[calc(100vh-10rem)] grid-rows-[1fr_auto] overflow-hidden rounded-lg border">
      <ScrollArea className="min-h-0">
        <div className="space-y-4 p-4">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn("flex gap-3", message.role === "user" && "justify-end")}
            >
              {message.role === "assistant" ? (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
                  <Bot className="size-3.5" />
                </div>
              ) : null}
              <div
                className={cn(
                  "max-w-3xl whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6",
                  message.role === "assistant" ? "bg-muted" : "bg-foreground text-background",
                )}
              >
                {message.content || "Thinking..."}
              </div>
              {message.role === "user" ? (
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
                  <User className="size-3.5" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="border-t bg-background p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SCOPES.map((scope) => (
            <button key={scope} type="button" onClick={() => insertScope(scope)}>
              <Badge variant="outline" className="rounded-md px-2 py-1 font-mono text-[11px]">
                {scope}
              </Badge>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={2}
            placeholder="@portfolio explain my concentration risk using the latest holdings"
            className="max-h-32 min-h-12 resize-none text-sm"
          />
          <Button type="submit" disabled={isStreaming || !input.trim()} className="h-auto w-12 shrink-0">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
