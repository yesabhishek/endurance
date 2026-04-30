import { redirect } from "next/navigation";
import { getKiteLoginLink } from "@/lib/kite/mcp";
import { getStoredKiteSessionId, storeKiteSessionId } from "@/lib/kite/sync";

export const runtime = "nodejs";

export async function GET() {
  const currentSessionId = await getStoredKiteSessionId();
  const { loginUrl, sessionId, alreadyLoggedIn } = await getKiteLoginLink(currentSessionId);
  await storeKiteSessionId(sessionId);
  if (alreadyLoggedIn) {
    redirect("/settings");
  }
  if (loginUrl) {
    redirect(loginUrl);
  }
  redirect("/settings");
}
