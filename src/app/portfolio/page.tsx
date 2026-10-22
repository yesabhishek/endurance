import { AlertTriangle, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AskButton } from "@/components/portfolio/ask-button";
import { AssetClassBar } from "@/components/portfolio/allocation";
import { DayMovers } from "@/components/portfolio/day-movers";
import { HoldingsHeatmap } from "@/components/portfolio/holdings-heatmap";
import { HoldingsTable } from "@/components/portfolio/holdings-table";
import { Sensitive } from "@/components/privacy/sensitive";
import { Panel } from "@/components/portfolio/panel";
import { RefreshButton } from "@/components/portfolio/refresh-button";
import { RiskMap } from "@/components/portfolio/risk-map";
import { RiskZones } from "@/components/portfolio/risk-zones";
import { SectorBars } from "@/components/portfolio/sector-bars";
import { ValueChart } from "@/components/portfolio/value-chart";
import { limits } from "@/lib/config";
import { getHistory, getPortfolioData } from "@/lib/data";
import { asOfLabel, inr, inrShort, pct } from "@/lib/format";
import { analyzePortfolio, shortName } from "@/lib/portfolio";
import { assessRisk } from "@/lib/risk";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const [data, history] = await Promise.all([getPortfolioData(), getHistory()]);
  const { snapshot, status } = data;

  if (!snapshot || !snapshot.holdings.length) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-16 md:px-8">
        <h1 className="font-display text-4xl">Portfolio</h1>
        <div className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6">
          <p className="text-[15px]">{snapshot ? "Kite returned no holdings for this account." : "Nothing to show yet. Log in to Kite to load your holdings, funds and positions."}</p>
          {status.state === "no-keys" ? (
            <Link href="/setup" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground">
              Open setup
            </Link>
          ) : (
            <a href="/api/kite/login" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground">
              <LogIn className="size-4" aria-hidden /> Log in to Kite
            </a>
          )}
        </div>
      </div>
    );
  }

  const config = limits();
  const p = analyzePortfolio(snapshot.holdings, config);
  const risk = assessRisk(p);
  const demo = snapshot.source === "demo";

  const tiles = p.holdings.map((h) => ({ id: h.key, label: shortName(h), name: h.name, group: h.sector, value: h.value, weightPct: h.weightPct, dayPct: h.assetClass === "MUTUAL_FUND" ? null : h.dayPct, returnPct: h.pnlPct }));
  const riskPoints = p.holdings
    .filter((h) => h.assetClass === "STOCK" && h.pnlPct !== null)
    .map((h) => ({ id: h.key, symbol: h.symbol, sector: h.sector, weightPct: h.weightPct, returnPct: h.pnlPct ?? 0, value: h.value, pnl: h.pnl }));
  const movers = p.holdings.filter((h) => h.dayChange !== 0).map((h) => ({ id: h.key, label: shortName(h), dayPct: h.dayPct, dayChange: h.dayChange }));
  const rows = p.holdings.map((h) => ({
    key: h.key,
    label: shortName(h),
    name: h.name,
    assetClass: h.assetClass,
    sector: h.sector,
    quantity: h.quantity,
    averagePrice: h.averagePrice,
    lastPrice: h.lastPrice,
    value: h.value,
    weightPct: h.weightPct,
    pnl: h.pnl,
    pnlPct: h.pnlPct,
    dayPct: h.assetClass === "MUTUAL_FUND" ? null : h.dayPct,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{demo ? "Sample portfolio" : `Kite · ${snapshot.account.userId}`}</p>
          <h1 className="font-display text-4xl md:text-[2.75rem]">Portfolio</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{demo ? "Demo data" : `As of ${asOfLabel(snapshot.asOf)}`}</span>
          {status.state === "connected" ? <RefreshButton /> : null}
          <AskButton question="Give me a two-minute briefing on my portfolio: what moved today, where my risk sits, and anything over my limits." label="Brief me" className="h-8 border bg-card px-3" />
        </div>
      </header>

      {status.state === "expired" || data.error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]">
          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
          <span className="flex-1">{data.error ? `${data.error} Showing the last saved snapshot.` : `Your Kite session ended. Showing the snapshot from ${asOfLabel(snapshot.asOf)}.`}</span>
          <a href="/api/kite/login" className="inline-flex items-center gap-1.5 font-medium">
            <LogIn className="size-4" aria-hidden /> Log in to Kite
          </a>
        </div>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-1 overflow-hidden rounded-lg border bg-card lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        <div className="flex flex-col justify-between gap-2 border-b p-6 lg:border-r lg:border-b-0">
          <span className="eyebrow">Current value</span>
          <span className="sensitive numeral text-5xl leading-none md:text-[3.5rem]">{inr(p.total)}</span>
          <span className={cn("text-sm tabular-nums", p.dayChange >= 0 ? "text-gain" : "text-loss")}>
            <Sensitive>
              {inr(p.dayChange, { signed: true })} ({pct(p.dayChangePct, { signed: true, digits: 2 })})
            </Sensitive>{" "}
            <span className="text-muted-foreground">today</span>
          </span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4">
          {[
            { label: "Invested", value: inrShort(p.invested), figure: true },
            { label: "Total P&L", value: inr(p.totalPnl, { signed: true }), sub: pct(p.totalPnlPct, { signed: true, digits: 2 }), tone: p.totalPnl >= 0 ? "gain" : "loss", figure: true, subFigure: true },
            { label: "Holdings", value: String(p.holdings.length), sub: `${p.sectors.filter((slice) => slice.label !== "Unclassified").length} sectors` },
            { label: "Available funds", value: snapshot.availableFunds === null ? "—" : inrShort(snapshot.availableFunds), sub: "Kite equity margin", figure: true },
          ].map((item, index) => (
            <div key={item.label} className={cn("flex flex-col gap-1.5 p-6", index % 2 === 0 && "border-r", index < 2 && "border-b sm:border-b-0", index === 1 && "sm:border-r", index === 2 && "sm:border-r")}>
              <dt className="eyebrow">{item.label}</dt>
              <dd className={cn("numeral text-2xl leading-tight", item.figure && "sensitive", item.tone === "gain" && "text-gain", item.tone === "loss" && "text-loss")}>{item.value}</dd>
              {item.sub ? <dd className={cn("text-xs text-muted-foreground tabular-nums", item.subFigure && "sensitive")}>{item.sub}</dd> : null}
            </div>
          ))}
        </dl>
      </section>

      <Panel id="trend" title="Value over time" subtitle="Current value against money invested, one point per day Endurance saved a snapshot." ask="How has my portfolio value changed over the last 3 months, excluding money I added?">
        <ValueChart points={history} />
      </Panel>

      <Panel id="heatmap" title="Holdings map" subtitle="Each tile is a holding, sized by value and grouped by sector or fund category." ask="Which holdings moved my portfolio most today, in rupees?">
        <HoldingsHeatmap tiles={tiles} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel id="allocation" title="Asset mix" subtitle="Share of current value by asset class." ask="How is my money split across stocks, funds, ETFs and gold?">
          <AssetClassBar slices={p.assetClasses} />
          {p.fundCategories.length ? (
            <div className="flex flex-col gap-3 border-t pt-5">
              <h3 className="text-[13px] font-medium text-muted-foreground">Funds, ETFs and gold by category</h3>
              <SectorBars slices={p.fundCategories} emptyText="No funds or ETFs." />
            </div>
          ) : null}
        </Panel>
        <Panel id="sectors" title="Stock sectors" subtitle={`Direct stocks by NSE sector, against your ${pct(config.sectorLimitPct, { digits: 0 })} sector limit.`} ask="Which sectors am I most exposed to through my stocks, and which holdings make them up?">
          <SectorBars slices={p.sectors} limitPct={config.sectorLimitPct} emptyText="No direct stock holdings." />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel id="risk" title="Risk checks" subtitle="Concentration and drawdown, measured against your own limits." ask="Walk me through my risk checks and what is driving each one.">
          <RiskZones report={risk} />
        </Panel>
        <Panel id="riskmap" title="Risk map" subtitle="Each stock by its share of your money and its return since you bought it.">
          <RiskMap points={riskPoints} limitPct={config.singleStockLimitPct} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel id="movers" title="Today's movers" subtitle="Largest moves today among stocks, ETFs and gold. Kite reports no day change for mutual funds." ask="What drove my portfolio's move today?">
          <DayMovers movers={movers} />
        </Panel>
        <Panel id="positions" title="Open positions" subtitle="Intraday and F&O positions, separate from holdings.">
          {snapshot.positions.length ? (
            <ul className="flex flex-col divide-y text-[13px]">
              {snapshot.positions.map((position) => (
                <li key={`${position.symbol}-${position.product}`} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-col">
                    <span className="font-medium">{position.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {position.product} · <Sensitive>{position.quantity}</Sensitive> qty
                    </span>
                  </span>
                  <span className={cn("sensitive tabular-nums", position.pnl >= 0 ? "text-gain" : "text-loss")}>{inr(position.pnl, { signed: true })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No open positions.</p>
          )}
        </Panel>
      </div>

      <Panel id="holdings" title="Holdings" subtitle={`${p.holdings.length} holdings across stocks, funds, ETFs and gold.`}>
        <HoldingsTable rows={rows} />
      </Panel>

      <p className="pb-4 text-center text-xs text-faint">Sectors come from NSE index constituent lists. Fund categories are inferred from scheme names. This is analysis of your data, not investment advice.</p>
    </div>
  );
}
