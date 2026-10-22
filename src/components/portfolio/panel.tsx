import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AskButton } from "./ask-button";

type PanelProps = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  /** A question to ask about this panel; shows an Ask button in the corner. */
  ask?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A section of the Portfolio page: white card, hairline border, title row. */
export function Panel({ id, title, subtitle, ask, action, children, className }: PanelProps) {
  return (
    <section aria-labelledby={`${id}-h`} className={cn("@container flex min-w-0 flex-col gap-5 rounded-lg border bg-card p-5 md:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-h`} className="text-[15px] font-medium tracking-[-0.005em]">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
          {action}
          {ask ? <AskButton question={ask} /> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Small segmented control for chart modes and ranges. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; disabled?: boolean; title?: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-muted/60 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
