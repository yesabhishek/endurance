import { NextResponse } from "next/server";
import { markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: string; all?: boolean };
  return NextResponse.json(await markNotificationsRead({ id: body.id, all: body.all }));
}
