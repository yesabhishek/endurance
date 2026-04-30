import { NextResponse } from "next/server";
import { listNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listNotifications());
}
