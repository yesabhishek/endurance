import { redirect } from "next/navigation";
import { getGoogleAuthUrl } from "@/lib/gmail/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/gmail/callback", request.url).toString();
  redirect(getGoogleAuthUrl(redirectUri));
}
