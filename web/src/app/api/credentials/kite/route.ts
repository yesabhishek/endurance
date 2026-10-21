import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { deleteCredential, saveCredential } from "@/lib/credentials";
import { clientMeta, readJson, withApi } from "@/lib/http";
import { disconnectKite } from "@/lib/kite/connection";

export const runtime = "nodejs";

const kiteValue = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9]{8,64}$/, `${label} should be the letters and numbers shown in the Kite developer console.`);

const bodySchema = z.object({
  apiKey: kiteValue("API key"),
  apiSecret: kiteValue("API secret"),
});

// Saves the user's own Kite Connect app. The secret is encrypted and never returned.
export const POST = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  const { apiKey, apiSecret } = await readJson(request, bodySchema);
  const saved = await saveCredential(db, user.id, "KITE_APP", { apiKey, apiSecret });
  await audit("credential.saved", { userId: user.id, ...clientMeta(request), metadata: { kind: "KITE_APP" } });
  return NextResponse.json({ ok: true, credential: saved });
});

// Logs out of Kite and forgets the app keys. Synced portfolio data stays until reset.
export const DELETE = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  await disconnectKite(db, user.id);
  await deleteCredential(db, user.id, "KITE_APP");
  await audit("credential.deleted", { userId: user.id, ...clientMeta(request), metadata: { kind: "KITE_APP" } });
  return NextResponse.json({ ok: true });
});
