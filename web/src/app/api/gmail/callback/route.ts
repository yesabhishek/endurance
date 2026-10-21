import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { decryptJson, safeEqual } from "@/lib/crypto";
import { completeGoogleOAuth } from "@/lib/gmail/auth";
import { GMAIL_OAUTH_COOKIE } from "@/lib/gmail/state";
import { clientMeta, seeOther, withApi } from "@/lib/http";
import { enqueueSyncRun } from "@/lib/sync/enqueue";

export const runtime = "nodejs";

export const GET = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const url = new URL(request.url);
  const store = await cookies();
  const raw = store.get(GMAIL_OAUTH_COOKIE)?.value;
  store.set(GMAIL_OAUTH_COOKIE, "", { path: "/api/gmail", maxAge: 0 });

  let saved: { state: string; codeVerifier: string } | null = null;
  try {
    saved = raw ? decryptJson(raw, `gmail-oauth:${user.id}`) : null;
  } catch {
    saved = null;
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!saved || !state || !safeEqual(saved.state, state)) return seeOther("/settings?gmail=state-mismatch#gmail");
  if (!code) return seeOther("/settings?gmail=cancelled#gmail");

  try {
    await completeGoogleOAuth(db, user.id, code, saved.codeVerifier);
  } catch (error) {
    console.error("[gmail] OAuth completion failed", error);
    return seeOther("/settings?gmail=failed#gmail");
  }

  await audit("gmail.connected", { userId: user.id, ...clientMeta(request) });
  await enqueueSyncRun(db, user.id, "GMAIL").catch((error) => console.error("[gmail] could not queue first sync", error));
  return seeOther("/settings?gmail=connected#gmail");
});
