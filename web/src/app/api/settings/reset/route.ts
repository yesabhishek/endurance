import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST() {
  const db = getDb();
  await db.$transaction([
    db.notification.deleteMany(),
    db.chatMessage.deleteMany(),
    db.chatThread.deleteMany(),
    db.investmentSnapshot.deleteMany(),
    db.holding.deleteMany(),
    db.investmentAccount.deleteMany(),
    db.transaction.deleteMany(),
    db.recurringPayment.deleteMany(),
    db.merchant.deleteMany(),
    db.parsedFinancialEmail.deleteMany(),
    db.emailSource.deleteMany(),
    db.syncCursor.deleteMany(),
    db.oAuthToken.deleteMany(),
    db.syncRun.deleteMany(),
    db.connectedAccount.deleteMany(),
  ]);
  redirect("/settings");
}
