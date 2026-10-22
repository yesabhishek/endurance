import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Floating readout positioned inside a relative chart container. Flips to the
 * left of the pointer when it would run off the right edge.
 */
export function ChartTooltip({ x, y, containerWidth, children, className }: { x: number; y: number; containerWidth: number; children: ReactNode; className?: string }) {
  const flip = x > containerWidth - 220;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none absolute z-10 min-w-40 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg shadow-black/5",
        className,
      )}
      style={{ left: flip ? undefined : x + 14, right: flip ? containerWidth - x + 14 : undefined, top: Math.max(0, y - 12) }}
    >
      {children}
    </div>
  );
}

/** One "value then label" line in a tooltip, keyed with a short stroke of the series color. */
export function TooltipRow({ color, label, value, tone }: { color?: string; label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color ? <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} /> : null}
      <span className={cn("sensitive font-semibold tabular-nums", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
