import { cookies } from "next/headers";
import { requireApiUser } from "@/lib/auth/guard";
import { encryptJson, randomToken } from "@/lib/crypto";
import { gmailConfigured, isHttps } from "@/lib/env";
import { startGoogleOAuth } from "@/lib/gmail/auth";
import { GMAIL_OAUTH_COOKIE } from "@/lib/gmail/state";
import { seeOther, withApi } from "@/lib/http";

export const runtime = "nodejs";

// Starts Google OAuth with a CSRF state and a PKCE verifier, both kept server-side
// in an encrypted, HttpOnly cookie bound to the signed-in user.
export const GET = withApi(async () => {
  const { user } = await requireApiUser();
  if (!gmailConfigured()) return seeOther("/settings?gmail=not-configured#gmail");

  const state = randomToken(24);
  const { url, codeVerifier } = await startGoogleOAuth(state);
  const store = await cookies();
  store.set(GMAIL_OAUTH_COOKIE, encryptJson({ state, codeVerifier }, `gmail-oauth:${user.id}`), {
    httpOnly: true,
    secure: isHttps(),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 10 * 60,
  });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
});
