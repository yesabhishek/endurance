import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/guard";
import { readJson, withApi } from "@/lib/http";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

export const GET = withApi(async () => {
  const { db } = await requireApiUser();
  return NextResponse.json(await listNotifications(db));
});

export const POST = withApi(async (request) => {
  const { db } = await requireApiUser();
  const body = await readJson(request, z.object({ id: z.string().max(64).optional(), all: z.boolean().optional() }));
  return NextResponse.json(await markNotificationsRead(db, body));
});
