"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/** Pulls a fresh snapshot from Kite and re-renders the page with it. */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/refresh", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Kite could not be reached.");
    }
    startTransition(() => router.refresh());
  }

  const spinning = busy || pending;
  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-xs text-loss">{error}</span> : null}
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={spinning}
        className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium transition-colors hover:border-foreground/30 disabled:opacity-60", className)}
      >
        <RefreshCw className={cn("size-3.5", spinning && "animate-spin")} aria-hidden />
        Refresh
      </button>
    </span>
  );
}
