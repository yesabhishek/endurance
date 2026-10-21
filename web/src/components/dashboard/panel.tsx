import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A dashboard section: hairline frame, title row, optional action on the right. */
export function Panel({ id, title, subtitle, action, children, className }: PanelProps) {
  return (
    <section aria-labelledby={`${id}-h`} className={cn("@container flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-h`} className="text-[0.95rem] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Small segmented control for chart modes and ranges. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; disabled?: boolean; title?: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-muted p-0.5">
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
            "h-7 rounded-[0.3rem] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value && "bg-card text-foreground shadow-sm",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
