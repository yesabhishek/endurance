import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guard";
import { clientMeta, readJson, withApi } from "@/lib/http";

export const runtime = "nodejs";

// Deletes this user's synced data and chat history. Keeps the account and saved keys.
export const POST = withApi(async (request) => {
  const { user, db } = await requireApiUser();
  await readJson(request, z.object({ confirm: z.literal("delete my data", { error: "Type the confirmation phrase exactly." }) }));

  await db.$transaction([
    db.notification.deleteMany({ where: {} }),
    db.chatMessage.deleteMany({ where: {} }),
    db.chatThread.deleteMany({ where: {} }),
    db.investmentSnapshot.deleteMany({ where: {} }),
    db.position.deleteMany({ where: {} }),
    db.holding.deleteMany({ where: {} }),
    db.investmentAccount.deleteMany({ where: {} }),
    db.transaction.deleteMany({ where: {} }),
    db.recurringPayment.deleteMany({ where: {} }),
    db.merchant.deleteMany({ where: {} }),
    db.parsedFinancialEmail.deleteMany({ where: {} }),
    db.emailSource.deleteMany({ where: {} }),
    db.syncCursor.deleteMany({ where: {} }),
    db.syncRun.deleteMany({ where: {} }),
  ]);

  await audit("data.reset", { userId: user.id, ...clientMeta(request) });
  return NextResponse.json({ ok: true });
});
