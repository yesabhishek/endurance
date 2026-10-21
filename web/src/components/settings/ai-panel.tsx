"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText, StatusPill } from "./section";
import { useApi } from "./use-api";

type ProviderKind = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "AI_GATEWAY";

type AiPanelProps = {
  providers: Array<{ kind: ProviderKind; label: string; keyUrl: string; suggested: string[] }>;
  saved: Array<{ kind: string; hint: string; lastVerifiedAt: string | null }>;
  chat: { provider: string | null; model: string | null };
};

export function AiPanel({ providers, saved, chat }: AiPanelProps) {
  const savedByKind = new Map(saved.map((item) => [item.kind, item]));

  return (
    <div className="flex flex-col gap-4">
      <ChatDefault providers={providers.filter((p) => savedByKind.has(p.kind))} chat={chat} />
      <div className="grid gap-3">
        {providers.map((provider) => (
          <ProviderRow key={provider.kind} provider={provider} saved={savedByKind.get(provider.kind) ?? null} isDefault={chat.provider === provider.kind} />
        ))}
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  saved,
  isDefault,
}: {
  provider: AiPanelProps["providers"][number];
  saved: AiPanelProps["saved"][number] | null;
  isDefault: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const api = useApi();
  const inputId = `key-${provider.kind}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const apiKey = String(new FormData(event.currentTarget).get("apiKey") ?? "");
    const result = await api.call<{ models: string[] }>("/api/credentials/ai", { method: "POST", body: { kind: provider.kind, apiKey } });
    if (result) {
      setEditing(false);
      toast.success(`${provider.label} key verified. ${result.models.length} models available.`);
    }
  }

  async function remove() {
    const result = await api.call("/api/credentials/ai", { method: "DELETE", body: { kind: provider.kind } });
    if (result) toast.success(`${provider.label} key removed.`);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-semibold">{provider.label}</span>
          {saved ? <StatusPill tone="ok">Key saved</StatusPill> : null}
          {isDefault ? <StatusPill tone="off">Chat default</StatusPill> : null}
        </div>
        {saved && !editing ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{saved.hint}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" className="text-loss hover:text-loss" onClick={remove} disabled={api.pending}>
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {!saved || editing ? (
        <form onSubmit={save} className="mt-4 flex flex-col gap-2">
          <Label htmlFor={inputId} className="sr-only">
            {provider.label} API key
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id={inputId} name="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder={`Paste your ${provider.label} API key`} required className="font-mono" />
            <Button type="submit" disabled={api.pending} className="shrink-0">
              {api.pending ? "Checking…" : "Verify and save"}
            </Button>
          </div>
          <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-primary underline underline-offset-4">
            Where do I get a key? <ExternalLink className="size-3" aria-hidden />
          </a>
          <ErrorText>{api.error}</ErrorText>
        </form>
      ) : null}
    </div>
  );
}

function ChatDefault({ providers, chat }: { providers: AiPanelProps["providers"]; chat: AiPanelProps["chat"] }) {
  const api = useApi();
  const [provider, setProvider] = useState<string>(chat.provider ?? providers[0]?.kind ?? "");
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState(chat.model ?? "");

  if (!providers.length) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Add at least one provider key below to turn on chat.</p>;
  }

  async function loadModels(kind: string) {
    const result = await api.call<{ models: string[] }>(`/api/credentials/ai?kind=${kind}`, { method: "GET" }, { refresh: false });
    if (result) {
      setModels(result.models);
      if (!result.models.includes(model)) setModel(result.models[0] ?? "");
    }
  }

  async function save() {
    const result = await api.call("/api/settings", { method: "PATCH", body: { chatProvider: provider, chatModel: model } });
    if (result) toast.success("Chat model saved.");
  }

  const suggestions = models ?? providers.find((p) => p.kind === provider)?.suggested ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-accent/40 p-4">
      <div className="text-sm font-semibold">Model used for chat</div>
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chat-provider">Provider</Label>
          <select
            id="chat-provider"
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              setModels(null);
              setModel("");
              void loadModels(event.target.value);
            }}
            className="h-9 rounded-md border bg-card px-2 text-sm"
          >
            {providers.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="chat-model">Model</Label>
          <Input
            id="chat-model"
            list="chat-model-options"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            onFocus={() => models === null && void loadModels(provider)}
            placeholder="Choose or type a model id"
            className="font-mono"
          />
          <datalist id="chat-model-options">
            {suggestions.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </div>
        <Button onClick={save} disabled={api.pending || !provider || !model}>
          Save
        </Button>
      </div>
      <ErrorText>{api.error}</ErrorText>
    </div>
  );
}
