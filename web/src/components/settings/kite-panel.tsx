"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, LogIn, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText, StatusPill } from "./section";
import { useApi } from "./use-api";

type KitePanelProps = {
  redirectUrl: string;
  app: { apiKey: string; hint: string } | null;
  connection: { state: "no-app" | "not-connected" | "expired" | "connected"; displayName?: string | null; externalId?: string; expiresAt?: string | null };
  syncActive: boolean;
};

export function KitePanel({ redirectUrl, app, connection, syncActive }: KitePanelProps) {
  const [editing, setEditing] = useState(!app);
  const [copied, setCopied] = useState(false);
  const api = useApi();

  async function saveApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api.call("/api/credentials/kite", {
      method: "POST",
      body: { apiKey: String(form.get("apiKey") ?? ""), apiSecret: String(form.get("apiSecret") ?? "") },
    });
    if (result) {
      setEditing(false);
      toast.success("Kite app saved. Next, log in to Kite.");
    }
  }

  async function copyRedirect() {
    try {
      await navigator.clipboard.writeText(redirectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy didn't work. Select the address and copy it manually.");
    }
  }

  async function sync() {
    const result = await api.call<{ enqueued: boolean }>("/api/sync/kite", { method: "POST" });
    if (result) toast.success(result.enqueued ? "Portfolio update started." : "An update is already running.");
  }

  async function removeApp() {
    const result = await api.call("/api/credentials/kite", { method: "DELETE" });
    if (result) {
      setEditing(true);
      toast.success("Kite app removed and logged out.");
    }
  }

  const status =
    connection.state === "connected" ? (
      <StatusPill tone="ok">Connected</StatusPill>
    ) : connection.state === "expired" ? (
      <StatusPill tone="warn">Log in again</StatusPill>
    ) : (
      <StatusPill tone="off">Not connected</StatusPill>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {status}
        {connection.displayName ? (
          <span className="text-sm text-muted-foreground">
            {connection.displayName} · {connection.externalId}
          </span>
        ) : null}
      </div>

      {editing ? (
        <ol className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-sm">
          <li className="flex flex-col gap-1">
            <span className="font-semibold">1. Create a Kite Connect app</span>
            <span className="text-muted-foreground">
              Sign in at the Kite developer console and create an app. The free Personal plan is enough for holdings and positions.
            </span>
            <a href="https://developers.kite.trade/apps" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-primary underline underline-offset-4">
              Open developers.kite.trade <ExternalLink className="size-3" aria-hidden />
            </a>
          </li>
          <li className="flex flex-col gap-2">
            <span className="font-semibold">2. Set the app&apos;s Redirect URL to this address</span>
            <div className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">{redirectUrl}</code>
              <Button type="button" variant="outline" size="sm" onClick={copyRedirect} aria-label="Copy redirect URL">
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </li>
          <li className="flex flex-col gap-3">
            <span className="font-semibold">3. Paste the app&apos;s API key and secret</span>
            <form onSubmit={saveApp} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kite-api-key">API key</Label>
                  <Input id="kite-api-key" name="apiKey" autoComplete="off" spellCheck={false} required defaultValue={app?.apiKey} className="font-mono" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="kite-api-secret">API secret</Label>
                  <Input id="kite-api-secret" name="apiSecret" type="password" autoComplete="off" spellCheck={false} required className="font-mono" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">The secret is encrypted on this server and is never shown again or sent to your browser.</p>
              <ErrorText>{api.error}</ErrorText>
              <div className="flex gap-2">
                <Button type="submit" disabled={api.pending}>
                  Save Kite app
                </Button>
                {app ? (
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </li>
        </ol>
      ) : (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">API key</dt>
            <dd className="truncate font-mono">{app?.apiKey}</dd>
            <dt className="text-muted-foreground">API secret</dt>
            <dd className="font-mono">{app?.hint}</dd>
            <dt className="text-muted-foreground">Redirect URL</dt>
            <dd className="truncate font-mono text-xs leading-6">{redirectUrl}</dd>
          </dl>
          {connection.state === "expired" ? (
            <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
              Kite ends every session early each morning. Log in again to refresh today&apos;s prices; your last snapshot stays visible meanwhile.
            </p>
          ) : null}
          <ErrorText>{api.error}</ErrorText>
          <div className="flex flex-wrap gap-2">
            {connection.state !== "connected" ? (
              <Button asChild>
                <a href="/api/kite/login">
                  <LogIn className="size-4" aria-hidden />
                  {connection.state === "expired" ? "Log in to Kite again" : "Log in to Kite"}
                </a>
              </Button>
            ) : (
              <Button onClick={sync} disabled={api.pending || syncActive}>
                <RefreshCw className="size-4" aria-hidden />
                {syncActive ? "Updating…" : "Refresh portfolio"}
              </Button>
            )}
            {connection.state === "connected" ? (
              <form action="/api/kite/disconnect" method="post">
                <Button type="submit" variant="outline">
                  Log out of Kite
                </Button>
              </form>
            ) : null}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Replace app keys
            </Button>
            <Button variant="ghost" className="text-loss hover:text-loss" onClick={removeApp} disabled={api.pending}>
              Remove app
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
