import { cookies } from "next/headers";
import { requireApiUser } from "@/lib/auth/guard";
import { readCredential } from "@/lib/credentials";
import { randomToken } from "@/lib/crypto";
import { isHttps } from "@/lib/env";
import { seeOther, withApi } from "@/lib/http";
import { kiteLoginUrl } from "@/lib/kite/client";
import { KITE_STATE_COOKIE } from "@/lib/kite/state";

export const runtime = "nodejs";

// Starts the Kite login. A random state is kept in an HttpOnly cookie and checked
// on the callback, so nobody can push their own Kite login into your session.
export const GET = withApi(async () => {
  const { user, db } = await requireApiUser();
  const app = await readCredential(db, user.id, "KITE_APP");
  if (!app) return seeOther("/settings?kite=no-app#kite");

  const state = randomToken(24);
  const store = await cookies();
  store.set(KITE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/api/kite",
    maxAge: 10 * 60,
  });

  return new Response(null, { status: 302, headers: { Location: kiteLoginUrl(app.apiKey, state), "Cache-Control": "no-store" } });
});
