"use client";

import { MessageSquareText } from "lucide-react";
import { useAsk } from "@/components/chat/ask";
import { cn } from "@/lib/utils";

/** Opens a new chat with this question already asked. */
export function AskButton({ question, label = "Ask", className }: { question: string; label?: string; className?: string }) {
  const ask = useAsk();
  return (
    <button
      type="button"
      onClick={() => ask(question)}
      title={question}
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
    >
      <MessageSquareText className="size-3.5" aria-hidden />
      {label}
    </button>
  );
}
