"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
  placeholder: string;
  footer?: ReactNode;
  size?: "large" | "default";
  autoFocus?: boolean;
};

/** The prompt box: grows with its text, Enter sends, Shift+Enter adds a line. */
export function Composer({ value, onChange, onSubmit, onStop, busy, disabled, placeholder, footer, size = "default", autoFocus }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy && value.trim()) onSubmit();
    }
  }

  const large = size === "large";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
      className={cn(
        "group flex flex-col rounded-xl border border-input bg-card shadow-[0_1px_2px_rgba(20,19,18,0.04),0_8px_24px_-12px_rgba(20,19,18,0.12)] transition-colors focus-within:border-foreground/40",
        disabled && "opacity-70",
      )}
    >
      <label htmlFor="composer" className="sr-only">
        Ask about your portfolio
      </label>
      <textarea
        id="composer"
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={large ? 2 : 1}
        maxLength={4000}
        className={cn(
          "w-full resize-none bg-transparent px-4 text-foreground outline-none placeholder:text-faint disabled:cursor-not-allowed",
          large ? "min-h-[84px] pt-4 pb-2 text-[17px] leading-relaxed" : "min-h-[52px] pt-3.5 pb-1 text-[15px] leading-relaxed",
        )}
      />
      <div className="flex items-center justify-between gap-3 px-3 pb-3">
        <div className="min-w-0 flex-1 truncate pl-1 text-xs text-muted-foreground">{footer}</div>
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Stop" className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-85">
            <Square className="size-3 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            aria-label="Send"
            className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
