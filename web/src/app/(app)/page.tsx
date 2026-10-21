import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, LogIn } from "lucide-react";
import { AskButton } from "@/components/chat/chat-dock";
import { AssetClassBar } from "@/components/dashboard/allocation";
import { DayMovers } from "@/components/dashboard/day-movers";
import { ForecastPanel } from "@/components/dashboard/forecast-panel";
import { HoldingsHeatmap, type HeatTile } from "@/components/dashboard/holdings-heatmap";
import { Panel } from "@/components/dashboard/panel";
import { RiskMap } from "@/components/dashboard/risk-map";
import { RiskZones } from "@/components/dashboard/risk-zones";
import { SectorBars } from "@/components/dashboard/sector-bars";
import { ValueChart } from "@/components/dashboard/value-chart";
import { PROVIDERS } from "@/lib/ai/providers";
import { requireUserDb } from "@/lib/auth/guard";
import { isAiKind } from "@/lib/credentials";
import { bucketWeights } from "@/lib/finance/forecast";
import { getPortfolio, getValueHistory, type HoldingView } from "@/lib/finance/portfolio";
import { assessRisk } from "@/lib/finance/risk";
import { asOfLabel, inr, inrShort, pct } from "@/lib/format";
import { getKiteConnectionState } from "@/lib/kite/connection";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const shortName = (holding: HoldingView) =>
  holding.assetClass === "MUTUAL_FUND" ? holding.name.split(" - ")[0].replace(/\s+fund$/i, "") : holding.symbol;

const dayPct = (holding: HoldingView) => {
  const previous = holding.value - holding.dayChange;
  return previous > 0 ? (holding.dayChange / previous) * 100 : 0;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { user, db } = await requireUserDb();
  const [portfolio, kite, settings, credentialKinds, activeSync, history] = await Promise.all([
    getPortfolio(db, user.id),
    getKiteConnectionState(db, user.id),
    db.userSettings.findUnique({ where: { userId: user.id } }),
    db.credential.findMany({ select: { kind: true } }),
    db.syncRun.findFirst({ where: { source: "KITE", status: { in: ["QUEUED", "RUNNING"] } } }),
    getValueHistory(db, 400),
  ]);

  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const firstName = user.name?.split(" ")[0];
  const provider = settings?.chatProvider && isAiKind(settings.chatProvider) ? settings.chatProvider : null;
  const chatReady = Boolean(provider && settings?.chatModel && credentialKinds.some((c) => c.kind === provider));
  const hasHoldings = portfolio.holdings.length > 0;
  const setupDone = kite.state !== "no-app" && kite.state !== "not-connected" && chatReady;

  const risk = assessRisk(portfolio);
  const tiles: HeatTile[] = portfolio.holdings.map((h) => ({
    id: h.id,
    label: shortName(h),
    name: h.name,
    group: h.sector,
    value: h.value,
    weightPct: h.weightPct,
    dayPct: dayPct(h),
    returnPct: h.pnlPct,
  }));
  const riskPoints = portfolio.holdings
    .filter((h) => h.assetClass === "STOCK" && h.pnlPct !== null)
    .map((h) => ({ id: h.id, symbol: h.symbol, sector: h.sector, weightPct: h.weightPct, returnPct: h.pnlPct ?? 0, value: h.value, pnl: h.pnl }));
  const movers = portfolio.holdings.filter((h) => h.dayChange !== 0).map((h) => ({ id: h.id, label: shortName(h), dayPct: dayPct(h), dayChange: h.dayChange }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl md:text-[1.75rem]">Hi{firstName ? `, ${firstName}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            {today}
            {hasHoldings ? ` · Holdings as of ${asOfLabel(portfolio.asOf)}` : ""}
          </p>
        </div>
        {hasHoldings ? (
          <AskButton
            question="Give me a two-minute briefing on my portfolio: what moved today, where my risk sits, and anything over my limits."
            label="Brief me on today"
            className="h-9 border border-brand/40 bg-accent px-3 text-sm"
          />
        ) : null}
      </div>

      {params.kite === "connected" ? (
        <p role="status" className="rounded-md bg-gain-soft px-4 py-3 text-sm text-gain">
          Kite connected. Your portfolio is syncing now; this page fills in within a few seconds.
        </p>
      ) : null}

      {kite.state === "expired" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
          <span className="flex-1">Kite ends sessions each morning around 6 AM. You&apos;re seeing the snapshot from {asOfLabel(portfolio.asOf)}.</span>
          <a href="/api/kite/login" className="inline-flex items-center gap-1.5 font-medium text-primary">
            <LogIn className="size-4" aria-hidden /> Log in to Kite
          </a>
        </div>
      ) : null}

      {!setupDone ? <SetupSteps kiteState={kite.state} chatReady={chatReady} /> : null}

      {hasHoldings ? (
        <>
          <section aria-label="Portfolio summary" className="grid grid-cols-1 overflow-hidden rounded-lg border bg-card @4xl:grid-cols-[19rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-5 border-b p-5 @4xl:border-r @4xl:border-b-0">
              <div>
                <div className="text-[0.8125rem] text-muted-foreground">Current value</div>
                <div className="numeral text-[2.5rem] leading-[1.1] @md:text-5xl">{inr(portfolio.total)}</div>
                <div className={cn("mt-1 text-sm font-medium tabular-nums", portfolio.dayChange >= 0 ? "text-gain" : "text-loss")}>
                  {inr(portfolio.dayChange, { signed: true })} ({pct(portfolio.dayChangePct, { signed: true, digits: 2 })}) <span className="font-normal text-muted-foreground">day&apos;s P&amp;L</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Investment</dt>
                  <dd className="font-semibold tabular-nums">{inrShort(portfolio.invested)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total P&amp;L</dt>
                  <dd className={cn("font-semibold tabular-nums", portfolio.totalPnl >= 0 ? "text-gain" : "text-loss")}>
                    {inrShort(portfolio.totalPnl)} <span className="text-xs">{pct(portfolio.totalPnlPct, { signed: true })}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Holdings</dt>
                  <dd className="font-semibold tabular-nums">
                    {portfolio.holdings.length} <span className="font-normal text-muted-foreground">in {portfolio.sectorCount} sectors</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Behaves like</dt>
                  <dd className="font-semibold tabular-nums">
                    {portfolio.concentration.effectivePositions.toFixed(1)} <span className="font-normal text-muted-foreground">equal holdings</span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="min-w-0 p-5">
              <h2 className="sr-only">Value over time</h2>
              <ValueChart points={history} />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <Panel
              id="heat"
              title="Portfolio heatmap"
              subtitle="Every holding sized by value and grouped by sector. Hover for details, click to ask."
              action={<AskButton question="Looking at my portfolio heatmap, which positions moved my value the most today and why does it matter given their size?" />}
            >
              <HoldingsHeatmap tiles={tiles} />
            </Panel>
            <Panel id="risk" title="Risk zones" subtitle={`Checked against your limits: ${pct(portfolio.limits.singleStockLimitPct, { digits: 0 })} a stock, ${pct(portfolio.limits.sectorLimitPct, { digits: 0 })} a sector.`} action={<Link href="/settings#limits" className="text-xs text-muted-foreground hover:text-foreground">Edit limits</Link>}>
              <RiskZones report={risk} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
            <Panel
              id="riskmap"
              title="Risk map"
              subtitle="Each stock by its share of your money and its return since you bought it."
              action={<AskButton question="Which stocks sit in the risk zones of my risk map, and what would it take to bring each back inside my limits?" />}
            >
              <RiskMap points={riskPoints} limitPct={portfolio.limits.singleStockLimitPct} />
            </Panel>
            <Panel
              id="alloc"
              title="Allocation"
              subtitle={`Asset classes across ${inrShort(portfolio.total)}, then NSE sectors within your ${inrShort(portfolio.equityTotal)} in stocks.`}
              action={<AskButton question="Is my allocation across stocks, funds, gold and sectors balanced for a long-term investor? Show the numbers." />}
            >
              <AssetClassBar slices={portfolio.assetClasses} />
              <div className="border-t pt-4">
                <SectorBars slices={portfolio.sectors} limitPct={portfolio.limits.sectorLimitPct} emptyText="No direct stock holdings yet." />
              </div>
              {portfolio.unclassified ? (
                <p className="text-xs text-muted-foreground">&quot;Unclassified&quot; stocks aren&apos;t in NSE&apos;s Total Market list, often SME or newly listed companies.</p>
              ) : null}
            </Panel>
          </div>

          <Panel
            id="forecast"
            title="20-year outlook"
            subtitle="Where today's portfolio could go, with the spread of outcomes. Switch on the AI forecast to have your model set assumptions for these exact holdings."
            action={<AskButton question="Walk me through my 20-year outlook. What assumptions drive it, and how much would a ₹25,000 monthly SIP with a 10% yearly step-up change it?" />}
          >
            <ForecastPanel startValue={portfolio.total} weights={bucketWeights(portfolio.holdings)} aiReady={chatReady} providerLabel={provider ? PROVIDERS[provider].label : null} />
          </Panel>

          <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <Panel id="movers" title="Today's movers" subtitle="Biggest gains and falls in your holdings today." action={<AskButton question="Explain today's biggest movers in my portfolio and how much each added or took away." />}>
              <DayMovers movers={movers} />
            </Panel>
            <Panel
              id="top"
              title="Largest holdings"
              action={
                <Link href="/investments" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  All {portfolio.holdings.length} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            >
              <div className="-mx-4 overflow-x-auto md:-mx-5">
                <table className="w-full min-w-[560px] text-[0.8125rem]">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium md:px-5">Instrument</th>
                      <th className="px-3 py-2 text-right font-medium">Cur. val</th>
                      <th className="px-3 py-2 text-right font-medium">Weight</th>
                      <th className="px-4 py-2 text-right font-medium md:px-5">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {portfolio.holdings.slice(0, 8).map((h) => {
                      const over = h.assetClass === "STOCK" && h.weightPct > portfolio.limits.singleStockLimitPct;
                      return (
                        <tr key={h.id} className="border-b last:border-0">
                          <td className="max-w-[15rem] px-4 py-2 md:px-5" title={h.name}>
                            <div className="truncate font-medium">{shortName(h)}</div>
                            <div className="truncate text-xs text-muted-foreground">{h.sector}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{inr(h.value)}</td>
                          <td className={cn("px-3 py-2 text-right", over && "font-semibold text-loss")}>{pct(h.weightPct)}</td>
                          <td className={cn("px-4 py-2 text-right md:px-5", h.pnl >= 0 ? "text-gain" : "text-loss")}>
                            {inr(h.pnl, { signed: true })}
                            <div className="text-xs">{pct(h.pnlPct, { signed: true })}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <p className="pb-16 text-xs text-muted-foreground xl:pb-0">
            Holdings and prices come from your own Zerodha Kite Connect app. Endurance is independent software you run yourself; it isn&apos;t made or endorsed by Zerodha.
          </p>
        </>
      ) : kite.state === "connected" ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          {activeSync ? "Your portfolio is syncing. Refresh in a few seconds." : "Kite is connected but no holdings were found. Refresh from Settings after your next trade settles."}
        </p>
      ) : null}
    </>
  );
}

function SetupSteps({ kiteState, chatReady }: { kiteState: string; chatReady: boolean }) {
  const steps = [
    { done: kiteState !== "no-app", title: "Add your Kite Connect app", detail: "Paste the API key and secret from developers.kite.trade.", href: "/settings#kite" },
    { done: kiteState === "connected" || kiteState === "expired", title: "Log in with Kite", detail: "Zerodha asks for your password and 2FA on its own site.", href: "/settings#kite" },
    { done: chatReady, title: "Add an AI key", detail: "OpenAI, Anthropic, Google or Vercel AI Gateway. Your key, your bill.", href: "/settings#ai" },
  ];
  const remaining = steps.filter((step) => !step.done).length;
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="setup-h">
      <div>
        <h2 id="setup-h" className="text-[0.95rem] font-semibold">
          {remaining === 3 ? "Three steps to your dashboard" : `${remaining} step${remaining === 1 ? "" : "s"} left`}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Endurance reads from your own Kite app and answers with your own AI key.</p>
      </div>
      <ol className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
        {steps.map((step) => (
          <li key={step.title}>
            <Link href={step.href} className="flex h-full gap-3 rounded-md border p-4 transition-colors hover:border-brand hover:bg-accent/40">
              {step.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gain" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-faint" aria-hidden />}
              <span className="flex flex-col gap-1">
                <span className={cn("text-sm font-semibold", step.done && "text-muted-foreground line-through decoration-1")}>{step.title}</span>
                <span className="text-[0.8125rem] text-muted-foreground">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
