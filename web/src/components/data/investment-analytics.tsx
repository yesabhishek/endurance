import type { Holding } from "@prisma/client";
import { currency } from "@/lib/format";

type BreakdownItem = {
  label: string;
  value: number;
  pct: number;
};

type InvestmentAnalyticsProps = {
  analytics: {
    assetAllocation: BreakdownItem[];
    gainers: Holding[];
    losers: Holding[];
  };
};

export function InvestmentAnalytics({ analytics }: InvestmentAnalyticsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Allocation title="Asset allocation" items={analytics.assetAllocation} />
      <Movers title="Top gainers" holdings={analytics.gainers} />
      <Movers title="Largest drawdowns" holdings={analytics.losers} />
    </section>
  );
}

function Allocation({ title, items }: { title: string; items: BreakdownItem[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: allocationColor(item.label, index) }} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 font-mono text-xs">
                  {currency(item.value, true)} · {item.pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, item.pct)}%`, backgroundColor: allocationColor(item.label, index) }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No portfolio data yet.</div>
        )}
      </div>
    </div>
  );
}

function Movers({ title, holdings }: { title: string; holdings: Holding[] }) {
  return (
    <div className="rounded-lg border p-4 lg:col-span-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {holdings.length ? (
          holdings.map((holding) => (
            <div key={holding.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{holding.name}</span>
              <span className={`font-mono text-xs ${Number(holding.pnl ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {currency(holding.pnl)}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No holdings yet.</div>
        )}
      </div>
    </div>
  );
}

function allocationColor(label: string, index: number) {
  const palette: Record<string, string> = {
    "Mutual Funds": "hsl(160 58% 38%)",
    Stocks: "hsl(220 64% 48%)",
    ETFs: "hsl(36 86% 48%)",
    Gold: "hsl(45 88% 47%)",
    Cash: "hsl(190 58% 38%)",
    Other: "hsl(270 42% 48%)",
  };
  const fallback = ["hsl(160 58% 38%)", "hsl(220 64% 48%)", "hsl(36 86% 48%)", "hsl(270 42% 48%)"];
  return palette[label] ?? fallback[index % fallback.length];
}
