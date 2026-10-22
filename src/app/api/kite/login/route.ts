import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { appUrl, isDemo, kiteKeys } from "@/lib/config";
import { KITE_STATE_COOKIE, kiteLoginUrl } from "@/lib/kite/client";

export const runtime = "nodejs";

const redirect = (location: string | URL) => new Response(null, { status: 302, headers: { Location: location.toString(), "Cache-Control": "no-store" } });

// Starts the Kite login. A random state goes into a short-lived cookie and is
// checked on the way back, so nobody can push their own Kite login into your app.
export async function GET(request: Request) {
  const keys = kiteKeys();
  if (!keys || isDemo()) return redirect(new URL("/setup?kite=no-keys", appUrl()));

  // The cookie must be set on the host Kite will send you back to (APP_URL),
  // or the callback can't read it. localhost and 127.0.0.1 are different hosts to a browser.
  const canonical = appUrl();
  if (request.headers.get("host") !== canonical.host) return redirect(new URL("/api/kite/login", canonical));

  const state = randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(KITE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: canonical.protocol === "https:",
    sameSite: "lax",
    path: "/api/kite",
    maxAge: 10 * 60,
  });
  return redirect(kiteLoginUrl(keys.apiKey, state));
}
