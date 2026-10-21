"use client";

import { useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ChartTooltip, TooltipRow } from "@/components/charts/chart-tooltip";
import { useElementWidth } from "@/components/charts/use-element-width";
import { Segmented } from "@/components/dashboard/panel";
import { linear, niceTicks } from "@/lib/charts/scale";
import { BASELINE, BUCKETS, BUCKET_LABELS, blend, project, type Assumptions, type Bucket } from "@/lib/finance/forecast";
import { asOfLabel, inr, inrCompact, inrShort, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const YEARS = 20;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 60 };
const SIP_PRESETS = [0, 10_000, 25_000, 50_000];

type AiResult = {
  assumptions: Assumptions;
  summary: string;
  drivers: string[];
  risks: string[];
  model: string;
  providerLabel: string;
  generatedAt: string;
  cached: boolean;
};

type AiState = { status: "idle" } | { status: "loading" } | { status: "consent" } | { status: "error"; message: string } | { status: "done"; result: AiResult };

type ForecastPanelProps = {
  startValue: number;
  weights: Record<Bucket, number>;
  aiReady: boolean;
  providerLabel: string | null;
};

export function ForecastPanel({ startValue, weights, aiReady, providerLabel }: ForecastPanelProps) {
  const [mode, setMode] = useState<"baseline" | "ai">("baseline");
  const [sip, setSip] = useState(0);
  const [stepUp, setStepUp] = useState<"0" | "5" | "10">("0");
  const [real, setReal] = useState<"nominal" | "real">("nominal");
  const [ai, setAi] = useState<AiState>({ status: "idle" });

  async function loadAi(refresh = false) {
    setAi({ status: "loading" });
    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refresh ? { refresh: true } : {}),
      });
      const body = (await response.json()) as AiResult & { error?: string; code?: string };
      if (response.status === 409 && body.code === "consent_required") return setAi({ status: "consent" });
      if (!response.ok) {
        // Fall back to the long-run view so the chart never shows baseline numbers under an "AI" label.
        setMode("baseline");
        return setAi({ status: "error", message: body.error ?? "The AI forecast couldn't be generated." });
      }
      setAi({ status: "done", result: body });
    } catch {
      setMode("baseline");
      setAi({ status: "error", message: "Couldn't reach Endurance. Check your connection and try again." });
    }
  }

  async function allowAndLoad() {
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiDataConsent: true }) });
    if (!response.ok) return toast.error("Couldn't save your choice. Try again.");
    void loadAi();
  }

  function changeMode(next: "baseline" | "ai") {
    setMode(next);
    if (next === "ai" && (ai.status === "idle" || ai.status === "error")) void loadAi();
  }

  const aiResult = ai.status === "done" ? ai.result : null;
  const assumptions = mode === "ai" && aiResult ? aiResult.assumptions : BASELINE;
  const mix = blend(weights, assumptions);
  const points = useMemo(
    () =>
      project({
        startValue,
        monthlySip: sip,
        stepUpPct: Number(stepUp),
        years: YEARS,
        expectedReturnPct: mix.expectedReturnPct,
        volatilityPct: mix.volatilityPct,
        inflationPct: assumptions.inflationPct,
        real: real === "real",
      }),
    [startValue, sip, stepUp, mix.expectedReturnPct, mix.volatilityPct, assumptions.inflationPct, real],
  );

  const end = points[YEARS];
  const thisYear = new Date().getFullYear();
  const showingAi = mode === "ai" && aiResult;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          label="Forecast basis"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "baseline", label: "Long-run averages" },
            { value: "ai", label: "AI forecast", disabled: !aiReady, title: aiReady ? `Assumptions from ${providerLabel}` : "Add an AI key in Settings to use the AI forecast" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Monthly SIP
          <span className="flex h-8 items-center rounded-md border border-input bg-card pl-2 focus-within:border-brand">
            <span aria-hidden>₹</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10_000_000}
              step={1000}
              value={sip || ""}
              placeholder="0"
              onChange={(event) => setSip(Math.max(0, Math.min(10_000_000, Number(event.target.value) || 0)))}
              className="h-full w-24 bg-transparent px-1.5 text-sm text-foreground tabular-nums outline-none"
            />
          </span>
        </label>
        <div className="flex gap-1" aria-label="SIP presets">
          {SIP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSip(preset)}
              className={cn("h-7 rounded-md border px-2 text-xs text-muted-foreground hover:text-foreground", sip === preset && "border-brand bg-accent text-accent-foreground")}
            >
              {preset ? inrCompact(preset) : "None"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden>Yearly step-up</span>
          <Segmented label="Yearly SIP step-up" value={stepUp} onChange={setStepUp} options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "10", label: "10%" }]} />
        </div>
        <Segmented label="Show values in" value={real} onChange={setReal} options={[{ value: "nominal", label: "Future ₹" }, { value: "real", label: "Today's ₹" }]} />
      </div>

      {mode === "ai" && ai.status === "consent" ? (
        <div className="flex flex-col gap-3 rounded-md border bg-accent/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> Send a portfolio summary to {providerLabel ?? "your AI provider"}?
          </div>
          <p className="text-sm text-muted-foreground">
            The forecast sends your asset mix, sector weights and largest holdings by symbol to {providerLabel ?? "your provider"} using your key. Your Kite login, account
            details and keys stay on this server. The same permission covers chat. Until then the chart shows long-run averages.
          </p>
          <button type="button" onClick={allowAndLoad} className="inline-flex h-9 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Allow and forecast
          </button>
        </div>
      ) : null}

      {ai.status === "error" ? (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-loss-soft px-3 py-2 text-sm text-loss">
          AI forecast unavailable: {ai.message} Showing long-run averages.
          <button
            type="button"
            onClick={() => {
              setMode("ai");
              void loadAi();
            }}
            className="font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={cn("relative transition-opacity", mode === "ai" && ai.status === "loading" && "opacity-50")}>
          {mode === "ai" && ai.status === "loading" ? (
            <div className="absolute inset-0 z-10 grid place-items-center">
              <span className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
                <Loader2 className="size-4 animate-spin text-brand" aria-hidden /> Asking {providerLabel} for assumptions…
              </span>
            </div>
          ) : null}
          <FanChart points={points} startYear={thisYear} />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Median value in {thisYear + YEARS}</div>
            <div className="numeral text-[1.75rem] leading-tight whitespace-nowrap">{inrShort(end.p50)}</div>
            <div className="text-xs text-muted-foreground">
              {(end.p50 / Math.max(startValue, 1)).toFixed(1)}× today&apos;s {inrShort(startValue)}
              {real === "real" ? `, in today's rupees at ${pct(assumptions.inflationPct, { digits: 1 })} inflation` : ""}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-sm">
            <dt className="text-muted-foreground">Likely range</dt>
            <dd className="text-right font-semibold whitespace-nowrap tabular-nums">
              {inrCompact(end.p25)} – {inrCompact(end.p75)}
            </dd>
            <dt className="text-muted-foreground">1 in 10 worse than</dt>
            <dd className="text-right font-semibold tabular-nums">{inrCompact(end.p10)}</dd>
            <dt className="text-muted-foreground">You&apos;d put in</dt>
            <dd className="text-right font-semibold tabular-nums">{inrCompact(end.contributed)}</dd>
            <dt className="text-muted-foreground">Blended return</dt>
            <dd className="text-right font-semibold tabular-nums">
              {pct(mix.expectedReturnPct)} <span className="font-normal text-muted-foreground">± {pct(mix.volatilityPct)}</span>
            </dd>
          </dl>
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">Projection milestones</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Year</th>
                <th className="py-1 text-right font-medium">Median</th>
                <th className="py-1 text-right font-medium">Likely range</th>
              </tr>
            </thead>
            <tbody>
              {[5, 10, 15, 20].map((year) => (
                <tr key={year} className="border-t">
                  <td className="py-1.5">{thisYear + year}</td>
                  <td className="py-1.5 text-right font-semibold">{inrCompact(points[year].p50)}</td>
                  <td className="py-1.5 text-right text-muted-foreground">
                    {inrCompact(points[year].p25)}–{inrCompact(points[year].p75)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showingAi ? (
        <div className="grid grid-cols-1 gap-4 rounded-md border bg-accent/30 p-4 @3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-brand" aria-hidden />
              <span>
                {aiResult.providerLabel} {aiResult.model} · {aiResult.cached ? "saved" : "generated"} {asOfLabel(aiResult.generatedAt)}
              </span>
              <button type="button" onClick={() => void loadAi(true)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <RefreshCw className="size-3" aria-hidden /> Regenerate
              </button>
            </div>
            <p className="text-sm leading-6">{aiResult.summary}</p>
          </div>
          <NoteList title="Could push it higher" items={aiResult.drivers} />
          <NoteList title="Could pull it lower" items={aiResult.risks} />
        </div>
      ) : null}

      <AssumptionTable assumptions={assumptions} weights={weights} source={showingAi ? "ai" : "baseline"} />

      <p className="text-xs text-muted-foreground">
        1,000 simulated paths of monthly returns, assuming today&apos;s mix is kept and rebalanced yearly. A projection from assumptions, not a prediction or investment advice.
        {aiReady ? null : (
          <>
            {" "}
            <Link href="/settings#ai" className="text-primary hover:underline">
              Add an AI key
            </Link>{" "}
            to have your own model set the assumptions for your holdings.
          </>
        )}
      </p>
    </div>
  );
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[0.8125rem] leading-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function AssumptionTable({ assumptions, weights, source }: { assumptions: Assumptions; weights: Record<Bucket, number>; source: "ai" | "baseline" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[0.8125rem]">
        <caption className="mb-2 text-left text-xs text-muted-foreground">
          {source === "ai" ? "Assumptions your AI model set for these holdings" : "Long-run assumptions in rupees"}, inflation {pct(assumptions.inflationPct)}
        </caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Bucket</th>
            <th className="py-2 pr-4 text-right font-medium">Your mix</th>
            <th className="py-2 pr-4 text-right font-medium">Return a year</th>
            <th className="py-2 pr-4 text-right font-medium">Volatility</th>
            <th className="py-2 font-medium">Why</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {BUCKETS.map((bucket) => {
            const row = assumptions.buckets[bucket];
            return (
              <tr key={bucket} className={cn("border-b last:border-0", weights[bucket] === 0 && "text-muted-foreground")}>
                <td className="py-2 pr-4 font-medium">{BUCKET_LABELS[bucket]}</td>
                <td className="py-2 pr-4 text-right">{pct(weights[bucket] * 100)}</td>
                <td className="py-2 pr-4 text-right">{pct(row.expectedReturnPct)}</td>
                <td className="py-2 pr-4 text-right">{pct(row.volatilityPct)}</td>
                <td className="py-2 text-muted-foreground">{row.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FanChart({ points, startYear }: { points: ReturnType<typeof project>; startYear: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...points.map((p) => p.p90)), 5);
  // Rounded to 0.1px: the simulation's last digits differ between Node and browsers,
  // and unrounded coordinates would make server and client markup disagree.
  const round = (value: number) => Math.round(value * 10) / 10;
  const xScale = linear([0, YEARS], [PAD.left, width - PAD.right]);
  const yScale = linear([0, ticks.at(-1)!], [HEIGHT - PAD.bottom, PAD.top]);
  const x = (value: number) => round(xScale(value));
  const y = (value: number) => round(yScale(value));

  const band = (low: "p10" | "p25", high: "p75" | "p90") =>
    `${points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p[high]).toFixed(1)}`).join("")}${points
      .toReversed()
      .map((p) => `L${x(p.year).toFixed(1)},${y(p[low]).toFixed(1)}`)
      .join("")}Z`;
  const line = (key: "p50" | "contributed") => points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const year = Math.round(((px - PAD.left) / (width - PAD.left - PAD.right)) * YEARS);
    setHover(Math.min(YEARS, Math.max(0, year)));
  }

  const active = hover !== null ? points[hover] : null;
  const end = points[YEARS];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-brand" /> Median path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-3 rounded-[2px] bg-brand/25" /> Likely (middle half)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-3 rounded-[2px] bg-brand/10" /> 8 in 10 outcomes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 rounded-full bg-faint" /> Money put in
        </span>
      </div>
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block h-auto max-w-full touch-none select-none"
          role="img"
          aria-label={`Projected value over ${YEARS} years: median ${inr(end.p50)}, likely range ${inr(end.p25)} to ${inr(end.p75)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--input)" : "var(--grid)"} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted-foreground)" className="tabular-nums">
                {inrCompact(tick)}
              </text>
            </g>
          ))}
          {[0, 5, 10, 15, 20].map((year) => (
            <text key={year} x={x(year)} y={HEIGHT - 8} textAnchor={year === 0 ? "start" : year === YEARS ? "end" : "middle"} fontSize={11} fill="var(--muted-foreground)">
              {startYear + year}
            </text>
          ))}
          <path d={band("p10", "p90")} fill="var(--brand)" opacity={0.1} />
          <path d={band("p25", "p75")} fill="var(--brand)" opacity={0.18} />
          <path d={line("contributed")} fill="none" stroke="var(--faint)" strokeWidth={2} strokeLinejoin="round" />
          <path d={line("p50")} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(YEARS)} cy={y(end.p50)} r={4.5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
          <text x={x(YEARS) - 8} y={y(end.p50) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--foreground)" paintOrder="stroke" stroke="var(--card)" strokeWidth={3}>
            {inrCompact(end.p50)}
          </text>
          {active && hover !== null ? (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
              <circle cx={x(hover)} cy={y(active.p50)} r={4.5} fill="var(--brand)" stroke="var(--card)" strokeWidth={2} />
            </g>
          ) : null}
        </svg>
        {active && hover !== null ? (
          <ChartTooltip x={x(hover)} y={y(active.p75)} containerWidth={width}>
            <div className="mb-1 font-medium">
              {startYear + hover} · year {hover}
            </div>
            <TooltipRow color="var(--brand)" label="Median" value={inr(active.p50)} />
            <TooltipRow label="Likely range" value={`${inrShort(active.p25)} – ${inrShort(active.p75)}`} />
            <TooltipRow label="8 in 10 between" value={`${inrShort(active.p10)} – ${inrShort(active.p90)}`} />
            <TooltipRow color="var(--faint)" label="Put in" value={inr(active.contributed)} />
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  );
}
