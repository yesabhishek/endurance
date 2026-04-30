import { redirect } from "next/navigation";
import { completeGoogleOAuth } from "@/lib/gmail/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    redirect("/settings?gmail=missing_code");
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/gmail/callback", request.url).toString();
  await completeGoogleOAuth(code, redirectUri);
  redirect("/settings?gmail=connected");
}
