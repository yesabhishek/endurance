import { CheckCircle2, CircleDashed, LogIn, LogOut, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { CopyButton } from "@/components/setup/copy-button";
import { aiConfig } from "@/lib/ai/provider";
import { dataDir, isDemo, kiteKeys, kiteRedirectUrl, limits } from "@/lib/config";
import { kiteStatus } from "@/lib/kite/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup" };

const KITE_MESSAGES: Record<string, string> = {
  "no-keys": "Add KITE_API_KEY and KITE_API_SECRET to .env and restart Endurance, then log in.",
  "state-mismatch": "That Kite login didn't start from this browser, or took longer than 10 minutes. Start it again from here.",
  cancelled: "The Kite login was cancelled.",
  "missing-token": "Kite didn't send a login token back. Try again.",
  "exchange-failed": "Kite rejected the login. Check that KITE_API_SECRET matches the app, and that the app's redirect URL is exactly the one below.",
};

type State = "done" | "todo" | "warn";

function Step({ n, title, state, children }: { n: number; title: string; state: State; children: React.ReactNode }) {
  const Icon = state === "done" ? CheckCircle2 : state === "warn" ? TriangleAlert : CircleDashed;
  return (
    <section className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-lg border bg-card p-5 md:p-6">
      <Icon className={cn("mt-0.5 size-5", state === "done" ? "text-gain" : state === "warn" ? "text-warn" : "text-faint")} aria-hidden />
      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-medium">
          <span className="mr-2 text-faint tabular-nums">{n}.</span>
          {title}
        </h2>
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </section>
  );
}

function Env({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">{children}</code>;
}

const button = "inline-flex h-9 w-fit items-center gap-2 rounded-md px-4 text-[13px] font-medium";

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [kite, ai] = [await kiteStatus(), aiConfig()];
  const keys = kiteKeys();
  const limit = limits();
  const redirectUrl = kiteRedirectUrl();
  const demo = isDemo();
  const message = params.kite ? KITE_MESSAGES[params.kite] : null;
  const expiry = kite.state === "connected" ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(kite.expiresAt)) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-4xl md:text-[2.75rem]">Setup</h1>
        <p className="max-w-2xl text-[15px] text-muted-foreground">
          Endurance runs on your computer with your own keys, which live in the <Env>.env</Env> file next to the code. Change it, then restart Endurance.
        </p>
      </header>

      {demo ? (
        <p className="rounded-lg border border-chart-4/40 bg-warn-soft px-4 py-3 text-[13.5px]">
          You&apos;re in demo mode (<Env>npm run demo</Env>). The portfolio is made up and Kite is not used. Run <Env>npm run dev</Env> for your own data.
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="rounded-lg border border-loss/25 bg-loss-soft px-4 py-3 text-[13.5px] text-loss">
          {message}
        </p>
      ) : null}

      <Step n={1} title="Create a Kite Connect app" state={keys ? "done" : "todo"}>
        <p>
          Sign in at{" "}
          <a href="https://developers.kite.trade/apps" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
            developers.kite.trade
          </a>{" "}
          and create an app. The free Personal plan covers holdings, funds and positions. Set its redirect URL to:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md border bg-muted/60 px-3 py-1.5 font-mono text-[12.5px] text-foreground">{redirectUrl}</code>
          <CopyButton value={redirectUrl} />
        </div>
        <p>
          Then put the app&apos;s key and secret in <Env>.env</Env> as <Env>KITE_API_KEY</Env> and <Env>KITE_API_SECRET</Env>.{" "}
          {keys ? <span className="text-gain">Found them.</span> : <span className="text-foreground">Not set yet.</span>}
        </p>
      </Step>

      <Step n={2} title="Log in to Kite" state={kite.state === "connected" || kite.state === "demo" ? "done" : kite.state === "expired" ? "warn" : "todo"}>
        {kite.state === "connected" ? (
          <>
            <p>
              Connected as <span className="text-foreground">{kite.userName}</span> ({kite.userId}). Zerodha ends every session early each morning; this one lasts until about {expiry}.
            </p>
            <form action="/api/kite/logout" method="post">
              <button type="submit" className={cn(button, "border bg-card text-foreground hover:border-foreground/30")}>
                <LogOut className="size-4" aria-hidden /> Log out of Kite
              </button>
            </form>
          </>
        ) : kite.state === "demo" ? (
          <p>Not needed in demo mode.</p>
        ) : (
          <>
            <p>
              {kite.state === "expired"
                ? `Your session as ${kite.userId} has ended. Kite needs a fresh login each day; your saved snapshot and chats are kept.`
                : "Zerodha asks for a login each day. Endurance only reads your data: it never calls Kite's order endpoints."}
            </p>
            {keys ? (
              <a href="/api/kite/login" className={cn(button, "bg-primary text-primary-foreground hover:opacity-90")}>
                <LogIn className="size-4" aria-hidden /> Log in to Kite
              </a>
            ) : (
              <p className="text-foreground">Finish step 1 first.</p>
            )}
          </>
        )}
      </Step>

      <Step n={3} title="Add an AI key" state={ai.ok ? "done" : "todo"}>
        {ai.ok ? (
          <p>
            Using <span className="text-foreground">{ai.label}</span> with model <Env>{ai.model}</Env>. Change <Env>AI_MODEL</Env> to use another.
          </p>
        ) : (
          <p className="text-foreground">{ai.problem}</p>
        )}
        <p>
          Set one of <Env>OPENAI_API_KEY</Env>, <Env>ANTHROPIC_API_KEY</Env>, <Env>GOOGLE_GENERATIVE_AI_API_KEY</Env> or <Env>AI_GATEWAY_API_KEY</Env>. For OpenRouter, Ollama or another OpenAI-compatible server, set <Env>OPENAI_BASE_URL</Env> and <Env>AI_MODEL</Env>.
        </p>
      </Step>

      <Step n={4} title="Your limits" state="done">
        <p>
          The risk checks and the assistant flag any stock above <span className="text-foreground">{limit.singleStockLimitPct}%</span> of your portfolio and any sector above{" "}
          <span className="text-foreground">{limit.sectorLimitPct}%</span> of your stocks. Change them with <Env>LIMIT_STOCK_PCT</Env> and <Env>LIMIT_SECTOR_PCT</Env>.
        </p>
      </Step>

      <section className="flex flex-col gap-3 rounded-lg border border-dashed p-5 text-[13.5px] leading-relaxed text-muted-foreground md:p-6">
        <h2 className="text-[15px] font-medium text-foreground">What leaves your computer</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Read-only requests to Zerodha&apos;s Kite API, using your own app and today&apos;s login.</li>
          <li>When you ask a question, the portfolio figures the assistant looks up are sent to {ai.ok ? ai.label : "your AI provider"} with your key.</li>
          <li>Once a week, NSE&apos;s public index lists are downloaded to label stocks by sector.</li>
        </ul>
        <p>
          Everything else (today&apos;s Kite session, daily snapshots and your chats) stays in <Env>{dataDir()}</Env>. Delete that folder to start fresh.
        </p>
      </section>
    </div>
  );
}
