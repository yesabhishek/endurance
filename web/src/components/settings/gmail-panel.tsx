"use client";

import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorText, StatusPill } from "./section";
import { useApi } from "./use-api";

export function GmailPanel({ configured, account, syncActive }: { configured: boolean; account: string | null; syncActive: boolean }) {
  const api = useApi();

  async function sync() {
    const result = await api.call<{ enqueued: boolean }>("/api/sync/gmail", { method: "POST" });
    if (result) toast.success(result.enqueued ? "Spending update started." : "An update is already running.");
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Optional. To read bills and receipts from Gmail, create a Google OAuth client (Web application), add the redirect URL shown in the README, then set{" "}
        <code className="font-mono">GOOGLE_CLIENT_ID</code> and <code className="font-mono">GOOGLE_CLIENT_SECRET</code> in <code className="font-mono">.env</code> and restart.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {account ? <StatusPill tone="ok">Connected</StatusPill> : <StatusPill tone="off">Not connected</StatusPill>}
        {account ? <span className="text-sm text-muted-foreground">{account}</span> : null}
      </div>
      <ErrorText>{api.error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant={account ? "outline" : "default"}>
          <a href="/api/gmail/connect">{account ? "Reconnect Gmail" : "Connect Gmail (read-only)"}</a>
        </Button>
        {account ? (
          <Button onClick={sync} disabled={api.pending || syncActive}>
            <RefreshCw className="size-4" aria-hidden />
            {syncActive ? "Updating…" : "Refresh spending"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
