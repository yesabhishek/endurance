import { NextResponse, type NextRequest } from "next/server";
import { SECURITY_HEADERS, buildCsp, isAllowedHost, isSameOriginWrite } from "@/lib/request-guard";

// Endurance has no sign-in: it listens on 127.0.0.1 only, so the one thing to keep
// out is other websites open in your browser. This blocks DNS rebinding and
// cross-site writes, and sets a strict CSP on every response.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!isAllowedHost(request.headers.get("host"), { appUrl, allowedHosts: process.env.ALLOWED_HOSTS })) {
    return new NextResponse("Unknown host. Add it to ALLOWED_HOSTS if you serve Endurance under this name.", { status: 421 });
  }

  if (!isSameOriginWrite(request.method, request.headers)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: appUrl.startsWith("https://"),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  if (appUrl.startsWith("https://")) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  if (pathname.startsWith("/api/")) response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
