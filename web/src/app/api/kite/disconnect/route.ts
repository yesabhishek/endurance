import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { clientMeta, seeOther, withApi } from "@/lib/http";
import { disconnectKite } from "@/lib/kite/connection";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  await disconnectKite(db, user.id);
  await audit("kite.disconnected", { userId: user.id, ...clientMeta(request) });
  return seeOther("/settings?kite=disconnected#kite");
});
