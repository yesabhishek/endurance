import type { Metadata } from "next";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { Panel } from "@/components/dashboard/panel";
import { SectorBars } from "@/components/dashboard/sector-bars";
import { ValueChart } from "@/components/dashboard/value-chart";
import { HoldingTable } from "@/components/data/holding-table";
import { requireUserDb } from "@/lib/auth/guard";
import { getPortfolio, getValueHistory } from "@/lib/finance/portfolio";
import { asOfLabel, inr, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Holdings" };
export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const { user, db } = await requireUserDb();
  const [portfolio, history] = await Promise.all([getPortfolio(db, user.id), getValueHistory(db, 400)]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl md:text-[1.75rem]">Holdings</h1>
        <p className="text-sm text-muted-foreground">Everything in your Kite account, as of {asOfLabel(portfolio.asOf)}</p>
      </div>

      <KpiStrip
        items={[
          { label: "Current value", value: inr(portfolio.total), sub: `${portfolio.holdings.length} holdings`, tone: "muted" },
          { label: "Investment", value: inr(portfolio.invested), tone: "muted" },
          {
            label: "Total P&L",
            value: inr(portfolio.totalPnl, { signed: true }),
            sub: pct(portfolio.totalPnlPct, { signed: true }),
            tone: portfolio.totalPnl >= 0 ? "gain" : "loss",
          },
          {
            label: "Concentration",
            value: pct(portfolio.concentration.top5Pct),
            sub: `in your top 5 · behaves like ${portfolio.concentration.effectivePositions.toFixed(1)} equal holdings`,
            tone: "muted",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel id="sector" title="Stocks by sector" subtitle="NSE sectors, as a share of your direct equity.">
          <SectorBars slices={portfolio.sectors} limitPct={portfolio.limits.sectorLimitPct} emptyText="No direct stock holdings yet." />
        </Panel>
        <Panel id="trend" title="Value over time" subtitle="One point per day Endurance synced.">
          <ValueChart points={history} />
        </Panel>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="holdings-h">
        <h2 id="holdings-h" className="text-[0.95rem] font-semibold">
          Holdings
        </h2>
        {portfolio.holdings.length ? (
          <HoldingTable holdings={portfolio.holdings} />
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Connect Kite in Settings to see your holdings.</p>
        )}
      </section>

      {portfolio.positions.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="positions-h">
          <h2 id="positions-h" className="text-[0.95rem] font-semibold">
            Open positions
          </h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Instrument</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg</th>
                  <th className="px-4 py-2.5 text-right font-medium">LTP</th>
                  <th className="px-4 py-2.5 text-right font-medium">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {portfolio.positions.map((p) => (
                  <tr key={`${p.exchange}:${p.symbol}:${p.product}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{p.symbol}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.product}</td>
                    <td className="px-4 py-2.5 text-right">{p.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{p.averagePrice?.toFixed(2) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{p.lastPrice?.toFixed(2) ?? "—"}</td>
                    <td className={cn("px-4 py-2.5 text-right", p.pnl >= 0 ? "text-gain" : "text-loss")}>{inr(p.pnl, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
