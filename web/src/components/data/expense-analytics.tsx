"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency, shortDate } from "@/lib/format";
import type { ExpenseRange } from "@/lib/finance/repositories";

type BreakdownItem = {
  label: string;
  value: number;
  pct: number;
};

type DailySpend = {
  date: string;
  amount: number;
  transactionCount: number;
};

type SubscriptionItem = {
  id: string;
  name: string;
  amount: number;
  cadence: string;
  status: string;
  lastSeenAt: Date | string;
};

type ExpenseAnalyticsProps = {
  range: ExpenseRange;
  analytics: {
    dailySpend: DailySpend[];
    maxDailySpend: number;
    categoryBreakdown: BreakdownItem[];
    merchantBreakdown: BreakdownItem[];
    subscriptions: SubscriptionItem[];
    subscriptionTotal: number;
  };
};

export function ExpenseRangeControls({ range }: { range: ExpenseRange }) {
  const from = format(new Date(range.from), "yyyy-MM-dd");
  const to = format(new Date(range.to), "yyyy-MM-dd");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["week", "month", "year"] as const).map((preset) => (
        <Button key={preset} asChild size="sm" variant={range.preset === preset ? "default" : "outline"}>
          <Link href={`/expenses?preset=${preset}`}>{capitalize(preset)}</Link>
        </Button>
      ))}
      <form action="/expenses" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="preset" value="custom" />
        <input
          aria-label="From date"
          className="h-7 rounded-md border bg-background px-2 text-xs"
          name="from"
          type="date"
          defaultValue={from}
        />
        <input
          aria-label="To date"
          className="h-7 rounded-md border bg-background px-2 text-xs"
          name="to"
          type="date"
          defaultValue={to}
        />
        <Button type="submit" size="sm" variant="outline">
          <CalendarDays className="size-3.5" />
          Apply
        </Button>
      </form>
    </div>
  );
}

export function ExpenseAnalytics({ range, analytics }: ExpenseAnalyticsProps) {
  const firstActiveDay = analytics.dailySpend.find((item) => item.amount > 0) ?? analytics.dailySpend[0] ?? null;
  const [selectedDay, setSelectedDay] = useState<DailySpend | null>(firstActiveDay);
  const activeDay = selectedDay ?? firstActiveDay;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Spend trend</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {shortDate(range.from)} to {shortDate(range.to)}
              </p>
            </div>
            <DaySummary day={activeDay} />
          </div>
          <TrendChart
            dailySpend={analytics.dailySpend}
            max={analytics.maxDailySpend}
            selectedDate={activeDay?.date}
            onSelect={setSelectedDay}
          />
        </div>

        <div className="flex min-h-[300px] flex-col rounded-lg border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Daily intensity</h2>
              <p className="mt-1 text-xs text-muted-foreground">Select a cell to inspect that day.</p>
            </div>
            <DaySummary day={activeDay} compact />
          </div>
          <Heatmap
            dailySpend={analytics.dailySpend}
            max={analytics.maxDailySpend}
            selectedDate={activeDay?.date}
            onSelect={setSelectedDay}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Categories" items={analytics.categoryBreakdown} />
        <Breakdown title="Merchants" items={analytics.merchantBreakdown} />
        <Subscriptions subscriptions={analytics.subscriptions} total={analytics.subscriptionTotal} />
      </div>
    </section>
  );
}

function TrendChart({
  dailySpend,
  max,
  selectedDate,
  onSelect,
}: {
  dailySpend: DailySpend[];
  max: number;
  selectedDate?: string;
  onSelect: (day: DailySpend) => void;
}) {
  const visible = dailySpend.length > 90 ? compressDailySpend(dailySpend, 64) : dailySpend;
  const chartMax = Math.max(max, 1);
  const points = visible.map((item, index) => {
    const x = visible.length > 1 ? (index / (visible.length - 1)) * 100 : 50;
    const y = 92 - (item.amount / chartMax) * 78;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `0,100 ${points.map((point) => `${point.x},${point.y}`).join(" ")} 100,100` : "";

  return (
    <div className="mt-5">
      <svg className="h-44 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Spend trend">
        <line x1="0" x2="100" y1="92" y2="92" className="stroke-muted" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2="100" y1="53" y2="53" className="stroke-muted" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {area ? <polygon points={area} className="fill-emerald-500/10" /> : null}
        {line ? (
          <polyline
            points={line}
            fill="none"
            className="stroke-emerald-700"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {points.map((point) => {
          const selected = selectedDate === point.date;
          return (
            <g key={point.date} className="group">
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? "2.4" : point.amount > 0 ? "1.6" : "1"}
                className={selected ? "fill-primary" : "fill-emerald-700"}
                role="button"
                tabIndex={0}
                aria-label={`${point.date}: ${currency(point.amount)}, ${point.transactionCount} transactions`}
                onClick={() => onSelect(point)}
                onFocus={() => onSelect(point)}
                onMouseEnter={() => onSelect(point)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(point);
                }}
                vectorEffect="non-scaling-stroke"
              />
              <title>
                {point.date}: {currency(point.amount)} · {point.transactionCount} transactions
              </title>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{visible[0]?.date ?? ""}</span>
        <span>Peak {currency(max, true)}</span>
        <span>{visible.at(-1)?.date ?? ""}</span>
      </div>
    </div>
  );
}

function Heatmap({
  dailySpend,
  max,
  selectedDate,
  onSelect,
}: {
  dailySpend: DailySpend[];
  max: number;
  selectedDate?: string;
  onSelect: (day: DailySpend) => void;
}) {
  const visible = useMemo(() => bucketHeatmapDays(dailySpend, 160), [dailySpend]);

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <div
        className="grid flex-1 content-start gap-1.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(22px, 1fr))" }}
      >
        {visible.map((item) => {
          const intensity = max > 0 ? item.amount / max : 0;
          const selected = selectedDate === item.date;
          return (
            <button
              key={item.date}
              type="button"
              aria-label={`${item.date}: ${currency(item.amount)}, ${item.transactionCount} transactions`}
              title={`${item.date}: ${currency(item.amount)} · ${item.transactionCount} transactions`}
              className={[
                "group relative aspect-square rounded-md border transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected ? "border-primary" : "border-transparent",
              ].join(" ")}
              style={{ backgroundColor: heatColor(intensity) }}
              onClick={() => onSelect(item)}
              onFocus={() => onSelect(item)}
              onMouseEnter={() => onSelect(item)}
            >
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-sm group-hover:block group-focus:block">
                {item.date} · {currency(item.amount)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
            <span key={intensity} className="size-3 rounded-[3px]" style={{ backgroundColor: heatColor(intensity) }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

function Breakdown({ title, items }: { title: string; items: BreakdownItem[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.slice(0, 6).map((item) => (
            <button
              key={item.label}
              type="button"
              title={`${item.label}: ${currency(item.value)} (${item.pct.toFixed(1)}%)`}
              className="group block w-full space-y-1.5 text-left"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="font-mono text-xs">{currency(item.value, true)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all group-hover:bg-brand"
                  style={{ width: `${Math.min(100, item.pct)}%` }}
                />
              </div>
            </button>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No spend in this range.</div>
        )}
      </div>
    </div>
  );
}

function Subscriptions({ subscriptions, total }: { subscriptions: SubscriptionItem[]; total: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Subscriptions</h2>
          <p className="mt-1 text-xs text-muted-foreground">{currency(total, true)} monthly</p>
        </div>
        <Badge variant="outline" className="rounded-md font-mono text-[10px]">
          {subscriptions.length} active
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {subscriptions.length ? (
          subscriptions.slice(0, 6).map((subscription) => (
            <button
              key={subscription.id}
              type="button"
              title={`${subscription.name}: ${currency(subscription.amount)} ${subscription.cadence}`}
              className="block w-full rounded-md text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{subscription.name}</span>
                <span className="font-mono text-xs">{currency(subscription.amount)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{subscription.cadence}</span>
                <span>{shortDate(subscription.lastSeenAt)}</span>
              </div>
            </button>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No subscriptions identified.</div>
        )}
      </div>
    </div>
  );
}

function DaySummary({ day, compact = false }: { day: DailySpend | null; compact?: boolean }) {
  if (!day) return null;

  return (
    <div className={compact ? "text-right text-xs" : "rounded-lg border px-3 py-2 text-right text-xs"}>
      <div className="font-medium">{formatDisplayDate(day.date)}</div>
      <div className="mt-1 font-mono">{currency(day.amount)}</div>
      <div className="text-muted-foreground">{day.transactionCount} transactions</div>
    </div>
  );
}

function compressDailySpend(items: DailySpend[], target: number) {
  const bucketSize = Math.ceil(items.length / target);
  const buckets: DailySpend[] = [];
  for (let index = 0; index < items.length; index += bucketSize) {
    const group = items.slice(index, index + bucketSize);
    buckets.push({
      date: group[0]?.date ?? "",
      amount: group.reduce((sum, item) => sum + item.amount, 0),
      transactionCount: group.reduce((sum, item) => sum + item.transactionCount, 0),
    });
  }
  return buckets;
}

function bucketHeatmapDays(items: DailySpend[], target: number) {
  return items.length > target ? compressDailySpend(items, target) : items;
}

function heatColor(intensity: number) {
  if (intensity <= 0) return "hsl(0 0% 91%)";
  const lightness = 84 - Math.min(1, intensity) * 46;
  return `hsl(160 55% ${lightness}%)`;
}

function formatDisplayDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
