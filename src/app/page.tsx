import { randomBytes } from "node:crypto";
import { AlertTriangle, ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import { Chat } from "@/components/chat/chat";
import { aiConfig } from "@/lib/ai/provider";
import { limits } from "@/lib/config";
import { getHistory, getPortfolioData } from "@/lib/data";
import { asOfLabel, inr, pct } from "@/lib/format";
import { analyzePortfolio } from "@/lib/portfolio";
import { suggestionsFor } from "@/lib/suggestions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function greeting(name: string | null) {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  const part = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first.charAt(0).toUpperCase()}${first.slice(1).toLowerCase()}` : part;
}

export default async function HomePage() {
  const [data, history] = await Promise.all([getPortfolioData(), getHistory()]);
  const ai = aiConfig();
  const analysis = data.snapshot ? analyzePortfolio(data.snapshot.holdings, limits()) : null;
  const { status, snapshot } = data;
  const name = status.state === "connected" || status.state === "expired" ? status.userName : null;

  const summary = analysis && snapshot ? (
    <p>
      Your portfolio is <span className="text-foreground tabular-nums">{inr(analysis.total)}</span>,{" "}
      <span className={cn("tabular-nums", analysis.dayChange > 0 ? "text-gain" : analysis.dayChange < 0 ? "text-loss" : "")}>
        {analysis.dayChange >= 0 ? "up" : "down"} {inr(Math.abs(analysis.dayChange))} ({pct(Math.abs(analysis.dayChangePct), { digits: 2 })})
      </span>{" "}
      today. {snapshot.source === "demo" ? "This is a sample portfolio." : `Kite data as of ${asOfLabel(snapshot.asOf)}.`}
    </p>
  ) : (
    <p>Ask anything about your Zerodha holdings. Every answer cites the data it used.</p>
  );

  let notice: React.ReactNode = null;
  if (status.state === "no-keys") {
    notice = (
      <SetupNotice title="Add your Kite Connect keys" body="Put KITE_API_KEY and KITE_API_SECRET in .env, restart, then log in to Kite." action={<Link href="/setup">Open setup <ArrowRight className="size-4" aria-hidden /></Link>} />
    );
  } else if (status.state === "logged-out") {
    notice = <SetupNotice title="Log in to Kite to load your portfolio" body="Zerodha asks for a fresh login each day. Endurance only reads your data; it can't place orders." action={<a href="/api/kite/login"><LogIn className="size-4" aria-hidden /> Log in to Kite</a>} />;
  } else if (status.state === "expired") {
    notice = (
      <SetupNotice
        tone="warn"
        title="Your Kite session ended this morning"
        body={snapshot ? `Answers use the snapshot from ${asOfLabel(snapshot.asOf)} until you log in again.` : "Log in again to load your portfolio."}
        action={<a href="/api/kite/login"><LogIn className="size-4" aria-hidden /> Log in to Kite</a>}
      />
    );
  } else if (data.error) {
    notice = <SetupNotice tone="warn" title="Couldn't refresh from Kite" body={`${data.error} Showing the last saved snapshot.`} />;
  }

  return (
    <Chat
      key={randomBytes(4).toString("hex")}
      id={randomBytes(12).toString("base64url")}
      initialMessages={[]}
      ai={{ ready: ai.ok, label: ai.ok ? `${ai.label} · ${ai.model}` : null, problem: ai.ok ? null : ai.problem }}
      home={{ greeting: greeting(name), summary, notice, suggestions: suggestionsFor(analysis, history.length) }}
    />
  );
}

function SetupNotice({ title, body, action, tone = "info" }: { title: string; body: string; action?: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between", tone === "warn" ? "border-warn/30 bg-warn-soft" : "bg-card")}>
      <div className="flex items-start gap-3">
        {tone === "warn" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden /> : null}
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-[13px] text-muted-foreground">{body}</span>
        </div>
      </div>
      {action ? (
        <div className="shrink-0 [&>a]:inline-flex [&>a]:h-9 [&>a]:items-center [&>a]:gap-2 [&>a]:rounded-md [&>a]:bg-primary [&>a]:px-4 [&>a]:text-[13px] [&>a]:font-medium [&>a]:text-primary-foreground [&>a]:hover:opacity-90">
          {action}
        </div>
      ) : null}
    </div>
  );
}
