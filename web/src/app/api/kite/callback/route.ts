import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { readCredential } from "@/lib/credentials";
import { safeEqual } from "@/lib/crypto";
import { clientMeta, seeOther, withApi } from "@/lib/http";
import { KiteError, exchangeRequestToken } from "@/lib/kite/client";
import { storeKiteSession } from "@/lib/kite/connection";
import { KITE_STATE_COOKIE as STATE_COOKIE } from "@/lib/kite/state";
import { enqueueSyncRun } from "@/lib/sync/enqueue";

export const runtime = "nodejs";

// Kite redirects here after login with ?request_token=...&status=success&state=...
export const GET = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const url = new URL(request.url);
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.set(STATE_COOKIE, "", { path: "/api/kite", maxAge: 0 });

  const state = url.searchParams.get("state");
  if (!expected || !state || !safeEqual(expected, state)) {
    return seeOther("/settings?kite=state-mismatch#kite");
  }
  if (url.searchParams.get("status") !== "success") {
    return seeOther("/settings?kite=cancelled#kite");
  }

  const requestToken = url.searchParams.get("request_token");
  if (!requestToken || !/^[a-zA-Z0-9]{8,128}$/.test(requestToken)) {
    return seeOther("/settings?kite=missing-token#kite");
  }

  const app = await readCredential(db, user.id, "KITE_APP");
  if (!app) return seeOther("/settings?kite=no-app#kite");

  try {
    const session = await exchangeRequestToken(app.apiKey, app.apiSecret, requestToken);
    await storeKiteSession(db, user.id, session);
    await audit("kite.connected", { userId: user.id, ...clientMeta(request), metadata: { kiteUserId: session.kiteUserId } });
  } catch (error) {
    console.error("[kite] token exchange failed", error instanceof KiteError ? `${error.errorType}: ${error.message}` : error);
    return seeOther("/settings?kite=exchange-failed#kite");
  }

  await enqueueSyncRun(db, user.id, "KITE").catch((error) => console.error("[kite] could not queue first sync", error));
  return seeOther("/?kite=connected");
});
