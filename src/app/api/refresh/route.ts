import { isDemo } from "@/lib/config";
import { refreshFromKite } from "@/lib/data";
import { KiteError } from "@/lib/kite/client";

export const runtime = "nodejs";

export async function POST() {
  if (isDemo()) return Response.json({ ok: true });
  try {
    const snapshot = await refreshFromKite();
    return Response.json({ ok: true, asOf: snapshot.asOf });
  } catch (error) {
    const message = error instanceof KiteError ? error.message : "Kite could not be reached.";
    return Response.json({ error: message }, { status: error instanceof KiteError && error.isTokenExpired ? 401 : 502 });
  }
}
