import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { HttpError, withApi } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueSyncRun } from "@/lib/sync/enqueue";

export const runtime = "nodejs";

const SOURCES = { kite: "KITE", gmail: "GMAIL" } as const;

export const POST = withApi(async (_request, context: { params: Promise<{ source: string }> }) => {
  const { user, db } = await requireApiUser();
  const { source } = await context.params;
  const syncSource = SOURCES[source as keyof typeof SOURCES];
  if (!syncSource) throw new HttpError(404, "Unknown data source.");

  const limit = await rateLimit("sync", `${user.id}:${syncSource}`);
  if (!limit.ok) throw new HttpError(429, "You've refreshed a lot recently. Try again later.");

  try {
    const { syncRun, enqueued } = await enqueueSyncRun(db, user.id, syncSource);
    return NextResponse.json({ ok: true, enqueued, syncRunId: syncRun.id });
  } catch {
    throw new HttpError(503, "The background worker isn't reachable. Check that Redis and the worker are running.");
  }
});
