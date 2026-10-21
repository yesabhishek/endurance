import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie-name";
import { SECURITY_HEADERS, buildCsp, isAllowedHost, isPublicPath, isSameOriginWrite } from "@/lib/request-guard";

// First line of defence for every request. Pages and route handlers still check
// the session themselves (requireUser / requireApiUser); this layer only rejects
// requests that can never be legitimate and adds security headers.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!isAllowedHost(request.headers.get("host"), { appUrl, allowedHosts: process.env.ALLOWED_HOSTS })) {
    return new NextResponse("Unknown host. Add it to ALLOWED_HOSTS if you serve Endurance under this name.", { status: 421 });
  }

  if (!isSameOriginWrite(request.method, request.headers)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
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
