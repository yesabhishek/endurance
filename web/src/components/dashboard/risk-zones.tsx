import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { AskButton } from "@/components/chat/chat-dock";
import type { RiskCheck, RiskReport, Zone } from "@/lib/finance/risk";
import { cn } from "@/lib/utils";

const ZONE_META: Record<Zone, { label: string; icon: typeof CheckCircle2; text: string; fill: string }> = {
  good: { label: "Comfortable", icon: CheckCircle2, text: "text-gain", fill: "bg-zone-good" },
  watch: { label: "Watch", icon: AlertTriangle, text: "text-warn", fill: "bg-zone-watch" },
  high: { label: "High", icon: OctagonAlert, text: "text-loss", fill: "bg-zone-high" },
};

const LEVEL_COPY: Record<RiskReport["level"], string> = {
  Low: "Nothing stands out. Your money is spread within your own limits.",
  Moderate: "A couple of checks are close to the edge. Worth a look before adding more to your largest positions.",
  Elevated: "One check is in the high zone. A sharp fall in that area would move your whole portfolio.",
  High: "Several checks are in the high zone. Your results depend heavily on a few positions.",
};

function display(check: RiskCheck, value = check.value) {
  return check.unit === "%" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

/** Five meters, each split into comfortable, watch and high zones, with a marker at today's value. */
export function RiskZones({ report }: { report: RiskReport }) {
  const levelZone: Zone = report.level === "Low" ? "good" : report.level === "Moderate" ? "watch" : "high";
  const LevelIcon = ZONE_META[levelZone].icon;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-md bg-muted/60 p-3">
        <LevelIcon className={cn("mt-0.5 size-5 shrink-0", ZONE_META[levelZone].text)} aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {report.level} concentration risk
            <span className="ml-2 font-normal text-muted-foreground">
              {report.highCount} high · {report.watchCount} watch
            </span>
          </div>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{LEVEL_COPY[report.level]}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-4">
        {report.checks.map((check) => (
          <RiskMeter key={check.id} check={check} />
        ))}
      </ul>
    </div>
  );
}

function RiskMeter({ check }: { check: RiskCheck }) {
  const meta = ZONE_META[check.zone];
  const Icon = meta.icon;
  const at = (value: number) => `${Math.min(100, Math.max(0, (value / check.max) * 100))}%`;
  // Bands run left to right in the order they appear on the track.
  const bands: Array<{ zone: Zone; from: number; to: number }> = check.higherIsWorse
    ? [
        { zone: "good", from: 0, to: check.watchAt },
        { zone: "watch", from: check.watchAt, to: check.highAt },
        { zone: "high", from: check.highAt, to: check.max },
      ]
    : [
        { zone: "high", from: 0, to: check.highAt },
        { zone: "watch", from: check.highAt, to: check.watchAt },
        { zone: "good", from: check.watchAt, to: check.max },
      ];

  return (
    <li className="group flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-medium">{check.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{display(check)}</span>
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.text)}>
            <Icon className="size-3.5" aria-hidden />
            {meta.label}
          </span>
        </span>
      </div>
      <div className="relative h-2" role="img" aria-label={`${check.label}: ${display(check)}, ${meta.label.toLowerCase()} zone`}>
        <div className="absolute inset-0 flex gap-0.5 overflow-hidden rounded-full">
          {bands.map((band) => (
            <span key={band.zone} className={cn("h-full", ZONE_META[band.zone].fill, band.zone === check.zone ? "opacity-70" : "opacity-25")} style={{ width: `${((band.to - band.from) / check.max) * 100}%` }} />
          ))}
        </div>
        <span
          aria-hidden
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground"
          style={{ left: at(check.value) }}
        />
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{check.detail}</p>
        {check.zone !== "good" ? <AskButton question={check.question} label="Why?" className="-mt-1 -mr-2" /> : null}
      </div>
    </li>
  );
}
