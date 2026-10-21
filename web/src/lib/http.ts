import { NextResponse } from "next/server";
import type { z } from "zod";
import { UnauthorizedError } from "@/lib/auth/guard";
import { getEnv } from "@/lib/env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

const MAX_JSON_BYTES = 64 * 1024;

/** Parses and validates a JSON body. Rejects non-JSON content types and oversized bodies. */
export async function readJson<T extends z.ZodType>(request: Request, schema: T, maxBytes = MAX_JSON_BYTES): Promise<z.infer<T>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Send the request as application/json.");
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body is not valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid request.");
  }
  return parsed.data;
}

/** Reads a urlencoded or multipart form body with a size cap. */
export async function readForm(request: Request, maxBytes = MAX_JSON_BYTES) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new HttpError(413, "Request body is too large.");
  return request.formData();
}

export function clientMeta(request: Request) {
  const forwarded = getEnv().TRUST_PROXY ? request.headers.get("x-forwarded-for") : null;
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  return { ip, userAgent: request.headers.get("user-agent") };
}

/**
 * Wraps a route handler: turns UnauthorizedError and HttpError into JSON errors and
 * hides unexpected error details from the client while logging them on the server.
 */
export function withApi<Ctx>(handler: (request: Request, context: Ctx) => Promise<Response>) {
  return async (request: Request, context: Ctx) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof UnauthorizedError) return jsonError(401, error.message);
      if (error instanceof HttpError) return jsonError(error.status, error.message);
      // Next.js uses thrown errors for redirect() and notFound(); let them through.
      if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_")) {
        throw error;
      }
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed`, error);
      return jsonError(500, "Something went wrong. Check the server logs for details.");
    }
  };
}

/**
 * Redirect after a form POST (303 so the browser follows with GET). The Location is
 * relative so the browser stays on whichever allowed host it used.
 */
export function seeOther(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("seeOther only accepts same-site paths.");
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}
