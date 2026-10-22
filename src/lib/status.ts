import type { ShellStatus } from "@/components/shell/app-shell";
import { aiConfig } from "./ai/provider";
import type { KiteStatus } from "./kite/session";

const time = (iso: string) => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** One-line Kite and AI status for the sidebar. */
export function shellStatus(kite: KiteStatus): ShellStatus {
  const ai = aiConfig();
  const kiteLine: ShellStatus["kite"] =
    kite.state === "connected"
      ? { tone: "ok", label: `Kite · ${kite.userId}`, detail: `Ends ${time(kite.expiresAt)}` }
      : kite.state === "expired"
        ? { tone: "warn", label: `Kite · ${kite.userId}`, detail: "Log in again" }
        : kite.state === "demo"
          ? { tone: "demo", label: "Demo portfolio", detail: "Sample data" }
          : kite.state === "no-keys"
            ? { tone: "off", label: "Kite keys missing", detail: "Add to .env" }
            : { tone: "off", label: "Kite not connected", detail: "Log in" };
  return {
    kite: kiteLine,
    ai: ai.ok ? { ready: true, provider: ai.baseUrl ? "custom" : ai.provider, name: ai.label, model: ai.model } : { ready: false, message: "AI key needed" },
  };
}
