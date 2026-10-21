"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Small helper for JSON calls from settings panels: pending state, error text, refresh on success. */
export function useApi() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call<T = Record<string, unknown>>(url: string, init: { method: string; body?: unknown }, options: { refresh?: boolean } = {}) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
      const body = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) {
        setError(body.error ?? `Request failed (${response.status}).`);
        return null;
      }
      if (options.refresh !== false) router.refresh();
      return body;
    } catch {
      setError("The server couldn't be reached.");
      return null;
    } finally {
      setPending(false);
    }
  }

  return { call, pending, error, setError };
}
