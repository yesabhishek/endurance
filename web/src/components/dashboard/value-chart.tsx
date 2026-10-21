"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { ChartTooltip, TooltipRow } from "@/components/charts/chart-tooltip";
import { useElementWidth } from "@/components/charts/use-element-width";
import { Segmented } from "@/components/dashboard/panel";
import { linear, niceTicks } from "@/lib/charts/scale";
import { inr, inrCompact, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Point = { date: string; value: number; invested: number };
type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_DAYS: Record<Range, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, ALL: Infinity };
const HEIGHT = 232;
const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

const dateLabel = (iso: string, withYear = false) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "2-digit" } : {}), timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** Current value against money put in, over a chosen range, with a crosshair readout. */
export function ValueChart({ points }: { points: Point[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const spanDays = points.length > 1 ? (Date.parse(points.at(-1)!.date) - Date.parse(points[0].date)) / 86_400_000 : 0;
  const ranges = (Object.keys(RANGE_DAYS) as Range[]).filter((range) => range === "ALL" || RANGE_DAYS[range] < spanDays + 20);
  const [range, setRange] = useState<Range>(ranges.includes("6M") ? "6M" : "ALL");
  const [hover, setHover] = useState<number | null>(null);

  const visible = useMemo(() => {
    if (range === "ALL" || !points.length) return points;
    const cutoff = Date.parse(points.at(-1)!.date) - RANGE_DAYS[range] * 86_400_000;
    return points.filter((point) => Date.parse(point.date) >= cutoff);
  }, [points, range]);

  if (points.length < 2) {
    return (
      <div className="grid h-[232px] place-items-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
        <p className="max-w-xs">The trend appears once Endurance has synced on two different days. Kite syncs each time you log in.</p>
      </div>
    );
  }

  const values = visible.flatMap((point) => [point.value, point.invested]);
  const ticks = niceTicks(Math.min(...values) * 0.98, Math.max(...values) * 1.01, 4);
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const x = linear([0, visible.length - 1], [PAD.left, width - PAD.right]);
  const y = linear([yMin, yMax], [HEIGHT - PAD.bottom, PAD.top]);

  const path = (key: "value" | "invested") => visible.map((point, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(point[key]).toFixed(1)}`).join("");
  const valueLine = path("value");
  const area = `${valueLine}L${x(visible.length - 1).toFixed(1)},${HEIGHT - PAD.bottom}L${PAD.left},${HEIGHT - PAD.bottom}Z`;

  const first = visible[0];
  const last = visible.at(-1)!;
  // Market change over the range, excluding money added or withdrawn.
  const gain = last.value - last.invested - (first.value - first.invested);
  const gainPct = first.value > 0 ? (gain / first.value) * 100 : 0;

  const tickCount = Math.max(2, Math.min(6, Math.floor(width / 120)));
  const xTicks = Array.from({ length: tickCount }, (_, i) => Math.round((i * (visible.length - 1)) / (tickCount - 1)));
  const multiYear = first.date.slice(0, 4) !== last.date.slice(0, 4);

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const index = Math.round(((px - PAD.left) / (width - PAD.left - PAD.right)) * (visible.length - 1));
    setHover(Math.min(visible.length - 1, Math.max(0, index)));
  }

  const active = hover !== null ? visible[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3 rounded-full bg-brand" /> Current value
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3 rounded-full bg-faint" /> Investment
          </span>
          <span className={cn("font-medium tabular-nums", gain >= 0 ? "text-gain" : "text-loss")}>
            {inr(gain, { signed: true })} ({pct(gainPct, { signed: true })}) market gain over {range === "ALL" ? "the period" : range}
          </span>
        </div>
        <Segmented label="Range" value={range} onChange={setRange} options={ranges.map((value) => ({ value, label: value === "ALL" ? "All" : value }))} />
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block h-auto max-w-full touch-none select-none"
          role="img"
          aria-label={`Portfolio value from ${dateLabel(first.date, true)} to ${dateLabel(last.date, true)}: ${inr(first.value)} to ${inr(last.value)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted-foreground)" className="tabular-nums">
                {inrCompact(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((index, i) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 6}
              fontSize={11}
              fill="var(--muted-foreground)"
              textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            >
              {dateLabel(visible[index].date, multiYear)}
            </text>
          ))}
          <path d={area} fill="var(--brand)" opacity={0.1} />
          <path d={path("invested")} fill="none" stroke="var(--faint)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={valueLine} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <circle cx={x(hover)} cy={y(active.invested)} r={4} fill="var(--faint)" stroke="var(--card)" strokeWidth={2} />
              <circle cx={x(hover)} cy={y(active.value)} r={4.5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
            </g>
          ) : (
            <circle cx={x(visible.length - 1)} cy={y(last.value)} r={4.5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
          )}
        </svg>
        {active && hover !== null ? (
          <ChartTooltip x={x(hover)} y={y(active.value)} containerWidth={width}>
            <div className="mb-1 font-medium">{dateLabel(active.date, true)}</div>
            <TooltipRow color="var(--brand)" label="Current value" value={inr(active.value)} />
            <TooltipRow color="var(--faint)" label="Investment" value={inr(active.invested)} />
            <TooltipRow label="Total P&L" value={inr(active.value - active.invested, { signed: true })} tone={active.value >= active.invested ? "gain" : "loss"} />
          </ChartTooltip>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Portfolio value by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Current value</th>
            <th>Investment</th>
          </tr>
        </thead>
        <tbody>
          {visible.filter((_, i) => i % 5 === 0 || i === visible.length - 1).map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{inr(point.value)}</td>
              <td>{inr(point.invested)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
