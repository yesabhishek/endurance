"use client";

import { useState, type PointerEvent } from "react";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useElementWidth } from "@/components/charts/use-element-width";
import { useChatDock } from "@/components/chat/chat-dock";
import { linear, niceTicks } from "@/lib/charts/scale";
import { inr, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RiskPoint = { id: string; symbol: string; sector: string; weightPct: number; returnPct: number; value: number; pnl: number };

type Status = "over" | "loss" | "ok";

const HEIGHT = 300;
const PAD = { top: 26, right: 16, bottom: 34, left: 52 };
const FILL: Record<Status, string> = { over: "var(--zone-high)", loss: "var(--zone-watch)", ok: "var(--brand)" };

function statusOf(point: RiskPoint, limit: number): Status {
  if (point.weightPct > limit) return "over";
  if (point.returnPct < 0) return "loss";
  return "ok";
}

/**
 * Each stock as a dot: how much of your money it holds (x) against how it has
 * done since you bought it (y). The shaded zones are where a position can hurt.
 */
export function RiskMap({ points, limitPct }: { points: RiskPoint[]; limitPct: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const { ask } = useChatDock();

  if (!points.length) return <p className="text-sm text-muted-foreground">No direct stock holdings to map.</p>;

  const maxWeight = Math.max(...points.map((p) => p.weightPct));
  const xTicks = niceTicks(0, Math.max(limitPct * 1.6, maxWeight * 1.12), 5);
  const returns = points.map((p) => p.returnPct);
  const yTicks = niceTicks(Math.min(-10, Math.min(...returns) * 1.1), Math.max(20, Math.max(...returns) * 1.08), 5);
  const x = linear([0, xTicks.at(-1)!], [PAD.left, width - PAD.right]);
  const y = linear([yTicks[0], yTicks.at(-1)!], [HEIGHT - PAD.bottom, PAD.top]);
  const plotRight = width - PAD.right;
  const plotBottom = HEIGHT - PAD.bottom;

  // Label the few dots the story is about: anything in a zone, plus the largest position.
  const labelled = new Set(
    [...points]
      .filter((p) => statusOf(p, limitPct) !== "ok" || p.weightPct === maxWeight)
      .sort((a, b) => b.weightPct - a.weightPct)
      .slice(0, 6)
      .map((p) => p.id),
  );

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const py = ((event.clientY - box.top) / box.height) * HEIGHT;
    let best: { id: string; distance: number } | null = null;
    for (const point of points) {
      const distance = Math.hypot(x(point.weightPct) - px, y(point.returnPct) - py);
      if (distance < 24 && (!best || distance < best.distance)) best = { id: point.id, distance };
    }
    setActive(best?.id ?? null);
  }

  // Place labels largest-first and drop any that would overlap one already placed.
  const placed: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  const visibleLabels = new Set<string>();
  for (const point of [...points].filter((p) => labelled.has(p.id)).sort((a, b) => b.weightPct - a.weightPct)) {
    const cx = x(point.weightPct) + 9;
    const cy = y(point.returnPct);
    const box = { x0: cx, x1: cx + point.symbol.length * 7, y0: cy - 7, y1: cy + 7 };
    const flipped = box.x1 > plotRight ? { ...box, x0: cx - 18 - point.symbol.length * 7, x1: cx - 18 } : box;
    if (placed.some((b) => flipped.x0 < b.x1 && flipped.x1 > b.x0 && flipped.y0 < b.y1 && flipped.y1 > b.y0)) continue;
    placed.push(flipped);
    visibleLabels.add(point.id);
  }

  const hovered = points.find((p) => p.id === active) ?? null;
  const ordered = [...points].sort((a, b) => (a.id === active ? 1 : b.id === active ? -1 : 0));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(
          [
            ["ok", "Within your limits"],
            ["loss", "Below cost"],
            ["over", `Over your ${pct(limitPct, { digits: 0 })} limit`],
          ] as const
        ).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: FILL[status] }} />
            {label}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block h-auto max-w-full touch-none select-none"
          role="img"
          aria-label={`Risk map of ${points.length} stocks by weight and return since purchase`}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onClick={() => hovered && ask(`${hovered.symbol} is ${pct(hovered.weightPct)} of my portfolio and ${pct(hovered.returnPct, { signed: true })} since I bought it. How much risk does it add?`)}
        >
          {/* Zones first, so marks sit on top. */}
          <rect x={x(limitPct)} y={PAD.top} width={Math.max(0, plotRight - x(limitPct))} height={plotBottom - PAD.top} fill="var(--zone-high)" opacity={0.07} />
          <rect x={PAD.left} y={y(0)} width={plotRight - PAD.left} height={Math.max(0, plotBottom - y(0))} fill="var(--zone-watch)" opacity={0.1} />
          <text x={plotRight - 6} y={PAD.top - 8} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
            Concentration zone
          </text>
          <text x={PAD.left + 6} y={plotBottom - 8} fontSize={11} fill="var(--muted-foreground)">
            Below cost
          </text>

          {yTicks.map((tick) => (
            <g key={`y${tick}`}>
              <line x1={PAD.left} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--input)" : "var(--grid)"} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted-foreground)" className="tabular-nums">
                {tick > 0 ? "+" : ""}
                {tick}%
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={`x${tick}`} x={x(tick)} y={plotBottom + 16} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" className="tabular-nums">
              {tick}%
            </text>
          ))}
          <text x={plotRight} y={HEIGHT - 2} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
            Share of portfolio →
          </text>
          <text x={4} y={12} fontSize={11} fill="var(--muted-foreground)">
            Return since bought
          </text>

          <line x1={x(limitPct)} x2={x(limitPct)} y1={PAD.top} y2={plotBottom} stroke="var(--zone-high)" strokeDasharray="4 3" strokeOpacity={0.8} />

          {ordered.map((point) => {
            const status = statusOf(point, limitPct);
            const cx = x(point.weightPct);
            const cy = y(point.returnPct);
            const isActive = point.id === active;
            return (
              <g key={point.id} className="cursor-pointer">
                <circle cx={cx} cy={cy} r={isActive ? 7 : 5.5} fill={FILL[status]} stroke="var(--card)" strokeWidth={2} />
                {(visibleLabels.has(point.id) && !active) || isActive ? (
                  <text
                    x={cx + 9 + point.symbol.length * 7 > plotRight ? cx - 9 : cx + 9}
                    y={cy}
                    dy="0.32em"
                    textAnchor={cx + 9 + point.symbol.length * 7 > plotRight ? "end" : "start"}
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--foreground)"
                    paintOrder="stroke"
                    stroke="var(--card)"
                    strokeWidth={3}
                  >
                    {point.symbol}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {hovered ? (
          <ChartTooltip x={x(hovered.weightPct)} y={y(hovered.returnPct)} containerWidth={width}>
            <div className="font-semibold">{hovered.symbol}</div>
            <div className="mb-1.5 text-muted-foreground">{hovered.sector}</div>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
              <dt className="text-muted-foreground">Weight</dt>
              <dd className={cn("text-right font-semibold", hovered.weightPct > limitPct && "text-loss")}>{pct(hovered.weightPct)}</dd>
              <dt className="text-muted-foreground">Since bought</dt>
              <dd className={cn("text-right font-semibold", hovered.returnPct >= 0 ? "text-gain" : "text-loss")}>{pct(hovered.returnPct, { signed: true })}</dd>
              <dt className="text-muted-foreground">P&amp;L</dt>
              <dd className={cn("text-right font-semibold", hovered.pnl >= 0 ? "text-gain" : "text-loss")}>{inr(hovered.pnl, { signed: true })}</dd>
            </dl>
            <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">Click to ask about it</div>
          </ChartTooltip>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>Stocks by weight and return</caption>
        <thead>
          <tr>
            <th>Stock</th>
            <th>Weight</th>
            <th>Return since bought</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{point.symbol}</td>
              <td>{pct(point.weightPct)}</td>
              <td>{pct(point.returnPct, { signed: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
