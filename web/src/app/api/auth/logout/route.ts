import { audit } from "@/lib/audit";
import { endSession, getSessionUser } from "@/lib/auth/session";
import { clientMeta, seeOther, withApi } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withApi(async (request) => {
  const user = await getSessionUser();
  await endSession();
  if (user) await audit("auth.logout", { userId: user.id, ...clientMeta(request) });
  return seeOther("/login");
});
