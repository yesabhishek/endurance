import { appUrl } from "@/lib/config";
import { logout } from "@/lib/kite/session";

export const runtime = "nodejs";

export async function POST() {
  await logout();
  return new Response(null, { status: 303, headers: { Location: new URL("/setup", appUrl()).toString() } });
}
