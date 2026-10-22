import { pct, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Mover = { id: string; label: string; dayPct: number; dayChange: number };

/** Today's biggest moves both ways, as bars growing from a shared zero line. */
export function DayMovers({ movers }: { movers: Mover[] }) {
  const gainers = movers.filter((m) => m.dayPct > 0).sort((a, b) => b.dayPct - a.dayPct).slice(0, 5);
  const losers = movers.filter((m) => m.dayPct < 0).sort((a, b) => a.dayPct - b.dayPct).slice(0, 5);
  const rows = [...gainers, ...losers.toReversed()];
  if (!rows.length) return <p className="text-sm text-muted-foreground">No price moves recorded today.</p>;
  const max = Math.max(...rows.map((row) => Math.abs(row.dayPct)), 0.5);

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const up = row.dayPct > 0;
        const width = `${(Math.abs(row.dayPct) / max) * 100}%`;
        return (
          <li key={row.id} className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center gap-x-0 text-[0.8125rem]">
            <span className="truncate pr-2 font-medium" title={row.label}>
              {row.label}
            </span>
            <span className="flex h-6 items-center justify-end border-r border-input">
              {!up ? <span className="h-3 rounded-l-[4px] bg-loss/80" style={{ width }} /> : null}
            </span>
            <span className="flex h-6 items-center">{up ? <span className="h-3 rounded-r-[4px] bg-gain/80" style={{ width }} /> : null}</span>
            <span className="flex flex-col items-end leading-tight tabular-nums">
              <span className={cn("sensitive text-xs font-semibold", up ? "text-gain" : "text-loss")}>{pct(row.dayPct, { signed: true, digits: 2 })}</span>
              <span className="sensitive text-[11px] text-muted-foreground">{inr(row.dayChange, { signed: true })}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
