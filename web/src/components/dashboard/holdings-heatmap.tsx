"use client";

import { useMemo, useState } from "react";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { useElementWidth } from "@/components/charts/use-element-width";
import { useChatDock } from "@/components/chat/chat-dock";
import { Segmented } from "@/components/dashboard/panel";
import { squarify } from "@/lib/charts/treemap";
import { inr, inrShort, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HeatTile = {
  id: string;
  label: string;
  name: string;
  group: string;
  value: number;
  weightPct: number;
  dayPct: number;
  returnPct: number | null;
};

type Metric = "day" | "return";

// Fixed domains so colours mean the same thing every day: ±3% for a day, ±50% since purchase.
const DOMAIN: Record<Metric, number> = { day: 3, return: 50 };
const STEPS = [0.25, 0.5, 0.75, 1];
const GAP = 2;
const HEADER = 18;

function heatStep(value: number, metric: Metric) {
  const t = Math.min(1, Math.abs(value) / DOMAIN[metric]);
  // Near-zero moves stay neutral grey; everything else snaps to one of four steps per side.
  if (t < 0.06) return 0;
  return STEPS.find((step) => t <= step) ?? 1;
}

function heatColor(value: number, metric: Metric) {
  const step = heatStep(value, metric);
  if (!step) return "var(--heat-mid)";
  const pole = value > 0 ? "var(--heat-up)" : "var(--heat-down)";
  return `color-mix(in oklab, ${pole} ${Math.round(18 + step * 82)}%, var(--heat-mid))`;
}

function metricValue(tile: HeatTile, metric: Metric) {
  return metric === "day" ? tile.dayPct : (tile.returnPct ?? 0);
}

/**
 * Two-level treemap: area is the share of your money, colour is the move.
 * Grouped by NSE sector for stocks and by category for funds, ETFs and gold.
 */
export function HoldingsHeatmap({ tiles }: { tiles: HeatTile[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [metric, setMetric] = useState<Metric>("day");
  const [active, setActive] = useState<string | null>(null);
  const { ask } = useChatDock();
  const height = width < 520 ? 320 : 380;

  const layout = useMemo(() => {
    const groups = new Map<string, HeatTile[]>();
    for (const tile of tiles) groups.set(tile.group, [...(groups.get(tile.group) ?? []), tile]);
    const groupItems = [...groups.entries()].map(([label, items]) => ({ label, items, value: items.reduce((sum, item) => sum + item.value, 0) }));
    return squarify(groupItems, { x: 0, y: 0, w: width, h: height }).map((group) => {
      const showHeader = group.h > 56 && group.w > 72;
      const inner = { x: group.x, y: group.y + (showHeader ? HEADER : 0), w: group.w, h: group.h - (showHeader ? HEADER : 0) };
      return { ...group, showHeader, cells: squarify(group.item.items, inner) };
    });
  }, [tiles, width, height]);

  const total = tiles.reduce((sum, tile) => sum + tile.value, 0);
  const activeTile = tiles.find((tile) => tile.id === active) ?? null;
  const activeCell = layout.flatMap((group) => group.cells).find((cell) => cell.item.id === active);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Colour by"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "day", label: "Today" },
            { value: "return", label: "Since bought" },
          ]}
        />
        <HeatLegend metric={metric} />
      </div>

      <div ref={ref} className="relative w-full" style={{ height }} onPointerLeave={() => setActive(null)}>
        {/* Tiles clip to the frame (they're laid out at a guessed width before the first measure); the tooltip doesn't. */}
        <div className="absolute inset-0 overflow-hidden">
          {layout.map((group) => (
            <div key={group.item.label}>
              {group.showHeader ? (
                <div
                  className="absolute flex items-center gap-1.5 overflow-hidden px-1 text-[11px] whitespace-nowrap text-muted-foreground"
                  style={{ left: group.x, top: group.y, width: group.w, height: HEADER }}
                >
                  <span className="truncate font-medium text-foreground">{group.item.label}</span>
                  <span className="tabular-nums">{pct((group.item.value / total) * 100)}</span>
                </div>
              ) : null}
              {group.cells.map((cell) => {
                const tile = cell.item;
                const value = metricValue(tile, metric);
                const step = heatStep(value, metric);
                const w = Math.max(0, cell.w - GAP);
                const h = Math.max(0, cell.h - GAP);
                const showLabel = w >= 46 && h >= 24;
                const showValue = w >= 46 && h >= 40;
                const big = w >= 110 && h >= 64;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onPointerEnter={() => setActive(tile.id)}
                    onFocus={() => setActive(tile.id)}
                    onBlur={() => setActive(null)}
                    onClick={() => ask(`Tell me about my ${tile.label} holding: its weight, P&L, and what it does to my ${tile.group} exposure.`)}
                    aria-label={`${tile.name}, ${pct(tile.weightPct)} of portfolio, ${pct(tile.dayPct, { signed: true, digits: 2 })} today, ${tile.returnPct === null ? "return unknown" : `${pct(tile.returnPct, { signed: true })} since bought`}. Ask about it.`}
                    className={cn(
                      "absolute flex flex-col items-start justify-between overflow-hidden rounded-[3px] p-1.5 text-left transition-[filter] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                      // Measured contrast: white only on the darkest light-mode step, near-black on strong dark-mode steps.
                      step === 1 ? "text-white" : "text-foreground",
                      step >= 0.75 && "dark:text-[#0b0d10]",
                      active === tile.id && "z-10 brightness-110 ring-2 ring-foreground/70 ring-offset-0",
                    )}
                    style={{ left: cell.x + GAP / 2, top: cell.y + GAP / 2, width: w, height: h, background: heatColor(value, metric) }}
                  >
                    {showLabel ? <span className={cn("max-w-full truncate leading-tight font-semibold", big ? "text-sm" : "text-[11px]")}>{tile.label}</span> : null}
                    {showValue ? (
                      <span className={cn("leading-tight tabular-nums", big ? "text-[13px]" : "text-[11px]", step === 1 ? "text-white/90" : "text-foreground/70", step >= 0.75 && "dark:text-[#0b0d10]/75")}>
                        {tile.returnPct === null && metric === "return" ? "—" : pct(value, { signed: true, digits: metric === "day" ? 2 : 1 })}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {activeTile && activeCell ? (
          <ChartTooltip x={Math.min(activeCell.x + activeCell.w / 2, width)} y={activeCell.y + 8} containerWidth={width}>
            <div className="max-w-56 truncate font-semibold">{activeTile.name}</div>
            <div className="mb-1.5 text-muted-foreground">{activeTile.group}</div>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 tabular-nums">
              <dt className="text-muted-foreground">Current value</dt>
              <dd className="text-right font-semibold">{inr(activeTile.value)}</dd>
              <dt className="text-muted-foreground">Weight</dt>
              <dd className="text-right font-semibold">{pct(activeTile.weightPct)}</dd>
              <dt className="text-muted-foreground">Today</dt>
              <dd className={cn("text-right font-semibold", activeTile.dayPct >= 0 ? "text-gain" : "text-loss")}>{pct(activeTile.dayPct, { signed: true, digits: 2 })}</dd>
              <dt className="text-muted-foreground">Since bought</dt>
              <dd className={cn("text-right font-semibold", (activeTile.returnPct ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                {activeTile.returnPct === null ? "—" : pct(activeTile.returnPct, { signed: true })}
              </dd>
            </dl>
            <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">Click to ask about it</div>
          </ChartTooltip>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Area is the share of your {inrShort(total)}. Colour is the move{metric === "day" ? " today, full at ±3%" : " since you bought, full at ±50%"}.
      </p>
    </div>
  );
}

function HeatLegend({ metric }: { metric: Metric }) {
  const domain = DOMAIN[metric];
  const swatches = [...STEPS.toReversed().map((step) => -step * domain), 0, ...STEPS.map((step) => step * domain)];
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums" aria-hidden>
      <span>−{domain}%</span>
      <span className="flex gap-0.5">
        {swatches.map((value) => (
          <span key={value} className="h-2.5 w-4 rounded-[2px] first:rounded-l last:rounded-r" style={{ background: heatColor(value, metric) }} />
        ))}
      </span>
      <span>+{domain}%</span>
    </div>
  );
}
