import { redirect } from "next/navigation";
import { enqueueSyncRun } from "@/lib/sync/enqueue";

export const runtime = "nodejs";

export async function POST() {
  await enqueueSyncRun("GMAIL");
  redirect("/settings");
}
