import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appUrl, kiteKeys } from "@/lib/config";
import { refreshFromKite } from "@/lib/data";
import { KITE_STATE_COOKIE, KiteError, exchangeRequestToken } from "@/lib/kite/client";
import { saveSession } from "@/lib/kite/session";

export const runtime = "nodejs";

const back = (path: string) => new Response(null, { status: 303, headers: { Location: new URL(path, appUrl()).toString(), "Cache-Control": "no-store" } });

function sameState(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Kite sends you here after login with ?request_token=...&status=success&state=...
export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const expected = store.get(KITE_STATE_COOKIE)?.value;
  store.set(KITE_STATE_COOKIE, "", { path: "/api/kite", maxAge: 0 });

  const state = url.searchParams.get("state");
  if (!expected || !state || !sameState(expected, state)) return back("/setup?kite=state-mismatch");
  if (url.searchParams.get("status") !== "success") return back("/setup?kite=cancelled");

  const requestToken = url.searchParams.get("request_token");
  if (!requestToken || !/^[a-zA-Z0-9]{8,128}$/.test(requestToken)) return back("/setup?kite=missing-token");

  const keys = kiteKeys();
  if (!keys) return back("/setup?kite=no-keys");

  try {
    await saveSession(await exchangeRequestToken(keys.apiKey, keys.apiSecret, requestToken));
  } catch (error) {
    console.error("[kite] token exchange failed:", error instanceof KiteError ? `${error.errorType}: ${error.message}` : error);
    return back("/setup?kite=exchange-failed");
  }

  // Load the portfolio now so the first page you see has data. A failure here is not fatal.
  await refreshFromKite().catch((error) => console.warn("[kite] first sync failed:", error instanceof Error ? error.message : error));
  return back("/");
}
