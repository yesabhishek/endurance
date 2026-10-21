import type { Metadata } from "next";
import { PROVIDERS } from "@/lib/ai/providers";
import { requireUserDb } from "@/lib/auth/guard";
import { AI_CREDENTIAL_KINDS, listCredentials } from "@/lib/credentials";
import { appUrl, gmailConfigured } from "@/lib/env";
import { shortDate } from "@/lib/format";
import { getKiteConnectionState } from "@/lib/kite/connection";
import { AiPanel } from "@/components/settings/ai-panel";
import { DataPanel } from "@/components/settings/data-panel";
import { GmailPanel } from "@/components/settings/gmail-panel";
import { KitePanel } from "@/components/settings/kite-panel";
import { LimitsPanel } from "@/components/settings/limits-panel";
import { SettingsSection } from "@/components/settings/section";

export const metadata: Metadata = { title: "Settings" };

const KITE_MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  "no-app": { tone: "warn", text: "Add your Kite app's API key and secret first." },
  "state-mismatch": { tone: "warn", text: "That Kite login didn't start from this browser session, so it was ignored. Try again." },
  cancelled: { tone: "warn", text: "The Kite login was cancelled." },
  "missing-token": { tone: "warn", text: "Kite didn't return a login token. Try again." },
  "exchange-failed": { tone: "warn", text: "Kite rejected the login. Check that the API secret matches this app and the redirect URL is exact." },
  disconnected: { tone: "ok", text: "Logged out of Kite. Your synced data is still here." },
};

const GMAIL_MESSAGES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  connected: { tone: "ok", text: "Gmail connected. Your first spending update is running." },
  "state-mismatch": { tone: "warn", text: "That Google sign-in didn't start from this session, so it was ignored." },
  cancelled: { tone: "warn", text: "Google sign-in was cancelled." },
  failed: { tone: "warn", text: "Google sign-in couldn't be completed. Check the OAuth client settings." },
  "not-configured": { tone: "warn", text: "Gmail isn't configured on this server yet." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { user, db } = await requireUserDb();

  const [credentials, kite, settings, gmailAccount, activeSyncs, auditEvents] = await Promise.all([
    listCredentials(db),
    getKiteConnectionState(db, user.id),
    db.userSettings.findUnique({ where: { userId: user.id } }),
    db.connectedAccount.findFirst({ where: { provider: "GMAIL", status: "CONNECTED" }, select: { externalId: true } }),
    db.syncRun.findMany({ where: { status: { in: ["QUEUED", "RUNNING"] } }, select: { source: true } }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
  ]);

  const kiteApp = credentials.find((item) => item.kind === "KITE_APP");
  const notice = (typeof params.kite === "string" && KITE_MESSAGES[params.kite]) || (typeof params.gmail === "string" && GMAIL_MESSAGES[params.gmail]) || null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl md:text-[1.75rem]">{params.welcome ? "Let's connect your accounts" : "Connections and keys"}</h1>
        <p className="max-w-2xl text-muted-foreground">
          Everything you enter here is encrypted on this server. Endurance only reads from Kite; it can&apos;t place orders.
        </p>
      </div>

      {notice ? (
        <p role="status" className={`rounded-lg px-4 py-3 text-sm ${notice.tone === "ok" ? "bg-gain-soft text-gain" : "bg-warn-soft text-warn"}`}>
          {notice.text}
        </p>
      ) : null}

      <div className="flex flex-col">
        <SettingsSection
          id="kite"
          title="Zerodha Kite"
          description={
            <>
              Uses your own Kite Connect app, so no one else&apos;s keys are involved. Kite requires a fresh login every morning; Endurance keeps showing your last snapshot until you log in.
            </>
          }
        >
          <KitePanel
            redirectUrl={new URL("/api/kite/callback", appUrl()).toString()}
            app={kiteApp ? { apiKey: kiteApp.publicId ?? "", hint: kiteApp.hint } : null}
            connection={{
              state: kite.state,
              displayName: "displayName" in kite ? kite.displayName : null,
              externalId: "externalId" in kite ? kite.externalId : undefined,
              expiresAt: kite.state === "connected" ? kite.expiresAt?.toISOString() ?? null : null,
            }}
            syncActive={activeSyncs.some((run) => run.source === "KITE")}
          />
        </SettingsSection>

        <SettingsSection
          id="ai"
          title="AI providers"
          description="Bring your own key for any provider. Chat only sends the specific numbers it needs for each answer to the provider you pick."
        >
          <AiPanel
            providers={AI_CREDENTIAL_KINDS.map((kind) => ({ kind, label: PROVIDERS[kind].label, keyUrl: PROVIDERS[kind].keyUrl, suggested: PROVIDERS[kind].suggested }))}
            saved={credentials
              .filter((item) => item.kind !== "KITE_APP")
              .map((item) => ({ kind: item.kind, hint: item.hint, lastVerifiedAt: item.lastVerifiedAt?.toISOString() ?? null }))}
            chat={{ provider: settings?.chatProvider ?? null, model: settings?.chatModel ?? null }}
          />
        </SettingsSection>

        <SettingsSection id="limits" title="Your limits" description="Endurance flags holdings and sectors above these weights on the dashboard and in chat answers.">
          <LimitsPanel singleStockLimitPct={Number(settings?.singleStockLimitPct ?? 10)} sectorLimitPct={Number(settings?.sectorLimitPct ?? 25)} />
        </SettingsSection>

        <SettingsSection id="gmail" title="Spending (optional)" description="Reads card statements, UPI receipts and subscription emails from Gmail, read-only. Raw email bodies are never stored.">
          <GmailPanel configured={gmailConfigured()} account={gmailAccount?.externalId ?? null} syncActive={activeSyncs.some((run) => run.source === "GMAIL")} />
        </SettingsSection>

        <SettingsSection id="history" title="Recent updates" description="The last few background syncs for your account.">
          {auditEvents.length ? (
            <ul className="divide-y rounded-lg border bg-card text-sm">
              {auditEvents.map((run) => (
                <li key={run.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_6rem_minmax(0,1fr)_7rem]">
                  <span className="font-medium">{run.source === "KITE" ? "Portfolio" : "Spending"}</span>
                  <span className={run.status === "SUCCESS" ? "text-gain" : run.status === "FAILED" ? "text-loss" : "text-muted-foreground"}>{run.status.toLowerCase()}</span>
                  <span className="truncate text-muted-foreground">{run.error ?? `${run.scanned} checked, ${run.inserted} new, ${run.updated} refreshed`}</span>
                  <span className="text-muted-foreground sm:text-right">{shortDate(run.startedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No updates yet.</p>
          )}
        </SettingsSection>

        <SettingsSection id="data" title="Your data" description="Remove what Endurance has synced for your account.">
          <DataPanel />
        </SettingsSection>
      </div>
    </>
  );
}
