import Link from "next/link";
import { Landmark, RefreshCw, Trash2, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/app/page-header";
import { getDb } from "@/lib/db";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const [accounts, syncRuns] = await Promise.all([
    db.connectedAccount.findMany({
      include: { tokens: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);

  const gmail = accounts.find((account) => account.provider === "GMAIL");
  const kite = accounts.find((account) => account.provider === "KITE");
  const gmailSyncActive = syncRuns.some((sync) => sync.source === "GMAIL" && ["QUEUED", "RUNNING"].includes(sync.status));
  const kiteSyncActive = syncRuns.some((sync) => sync.source === "KITE" && ["QUEUED", "RUNNING"].includes(sync.status));
  const gmailConfigReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Connections and updates"
        description="Manage the data sources that power your private finance workspace."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="size-4" />
                Spending Data
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Read-only expense, bill, merchant, and subscription updates.
              </p>
            </div>
            <Badge variant="outline" className="rounded-md font-mono text-[10px]">
              {gmail ? "CONNECTED" : gmailConfigReady ? "READY" : "CONFIG NEEDED"}
            </Badge>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account</span>
              <span className="font-mono">{gmail?.accountEmail ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connection config</span>
              <span className="font-mono">{gmailConfigReady ? "set" : "missing"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">History window</span>
              <span className="font-mono">{process.env.GMAIL_SYNC_MONTHS ?? "48"} months</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last connected</span>
              <span className="font-mono">{shortDate(gmail?.tokens[0]?.createdAt)}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/api/gmail/connect">Connect Spending Data</Link>
            </Button>
            <form action="/api/sync/gmail" method="post">
              <Button type="submit" variant="outline" size="sm" disabled={!gmail || gmailSyncActive}>
                <RefreshCw className="size-3.5" />
                {gmailSyncActive ? "Update queued" : "Update Spending Data"}
              </Button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="size-4" />
                Investment Data
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Read-only portfolio holdings, accounts, mutual funds, and valuation updates.
              </p>
            </div>
            <Badge variant="outline" className="rounded-md font-mono text-[10px]">
              {kite?.scope ? "CONNECTED" : "CONNECT"}
            </Badge>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Connection</span>
              <span className="truncate font-mono">{kite?.scope ? "ready" : "not connected"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mode</span>
              <span className="font-mono">read only</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session</span>
              <span className="font-mono">{kite?.scope ? "stored" : "—"}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/api/kite/login">Connect Investment Data</Link>
            </Button>
            <form action="/api/sync/kite" method="post">
              <Button type="submit" size="sm" disabled={kiteSyncActive}>
                <RefreshCw className="size-3.5" />
                {kiteSyncActive ? "Update queued" : "Update Investment Data"}
              </Button>
            </form>
            <form action="/api/settings/reset" method="post">
              <Button type="submit" variant="outline" size="sm">
                <Trash2 className="size-3.5" />
                Reset local data
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Update history</h2>
        <div className="rounded-lg border">
          {syncRuns.length ? (
            syncRuns.map((sync, index) => (
              <div key={sync.id}>
                <div className="grid gap-2 p-3 text-sm md:grid-cols-[120px_120px_1fr_120px]">
                  <div className="font-medium">{sync.source === "GMAIL" ? "Spending Data" : "Investment Data"}</div>
                  <div className="font-mono text-xs">{sync.status}</div>
                  <div className="text-muted-foreground">
                    scanned {sync.scanned}, inserted {sync.inserted}, updated {sync.updated}
                    {sync.error ? ` · ${displayUpdateError(sync.source)}` : ""}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground md:text-right">
                    {shortDate(sync.startedAt)}
                  </div>
                </div>
                {index < syncRuns.length - 1 ? <Separator /> : null}
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-muted-foreground">No updates yet.</div>
          )}
        </div>
      </section>
    </>
  );
}

function displayUpdateError(source: "GMAIL" | "KITE") {
  return source === "GMAIL"
    ? "Spending Data could not be updated. Reconnect and try again."
    : "Investment Data could not be updated. Reconnect and try again.";
}
