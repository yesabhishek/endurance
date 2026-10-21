import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { withApi } from "@/lib/http";

export const runtime = "nodejs";

export const DELETE = withApi(async (_request, context: { params: Promise<{ id: string }> }) => {
  const { db } = await requireApiUser();
  const { id } = await context.params;
  await db.chatThread.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
});
