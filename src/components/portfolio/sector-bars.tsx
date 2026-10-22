import type { Slice } from "@/lib/portfolio";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

type SectorBarsProps = {
  slices: Slice[];
  limitPct?: number;
  emptyText: string;
};

/** Horizontal bars sorted by weight, with an optional dashed line at the user's limit. */
export function SectorBars({ slices, limitPct, emptyText }: SectorBarsProps) {
  if (!slices.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const max = Math.max(...slices.map((slice) => slice.pct), limitPct ?? 0);
  const scale = Math.min(100, Math.max(10, Math.ceil((max * 1.15) / 10) * 10));

  return (
    <div className="flex flex-col gap-2.5">
      <ul className="flex flex-col gap-2.5">
        {slices.map((slice) => {
          const over = limitPct !== undefined && slice.label !== "Unclassified" && slice.pct > limitPct;
          return (
            <li key={slice.label} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 text-[0.8125rem] @sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem]">
              <span className="col-span-2 truncate @sm:col-span-1" title={`${slice.label}: ${slice.count} holding${slice.count === 1 ? "" : "s"}`}>
                {slice.label}
              </span>
              <span className="relative h-2.5 rounded-r-[4px] bg-muted" aria-hidden>
                <span className={cn("absolute inset-y-0 left-0 rounded-r-[4px]", over ? "bg-zone-high" : "bg-bar")} style={{ width: `${(slice.pct / scale) * 100}%` }} />
                {limitPct !== undefined ? (
                  <span className="absolute -inset-y-1 border-l border-dashed border-muted-foreground" style={{ left: `${(limitPct / scale) * 100}%` }} />
                ) : null}
              </span>
              <span className={cn("sensitive text-right tabular-nums", over ? "font-semibold text-loss" : "text-muted-foreground")}>
                {pct(slice.pct)}
                {over ? <span className="sr-only"> (over your limit)</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        {limitPct !== undefined ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-4 border-t border-dashed border-muted-foreground" aria-hidden />
            Your {pct(limitPct, { digits: 0 })} limit
          </span>
        ) : (
          <span />
        )}
        <span>Scale 0 to {scale}%</span>
      </div>
    </div>
  );
}
