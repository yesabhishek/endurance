// Pure helpers used by src/proxy.ts. Kept free of Node-only imports so they are easy to test.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type GuardConfig = {
  appUrl: string;
  allowedHosts?: string;
};

function hostnameOf(host: string) {
  // "[::1]:3000" -> "[::1]", "localhost:3000" -> "localhost"
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  return host.split(":")[0] ?? host;
}

/**
 * A request may only arrive under a host we serve. This blocks DNS-rebinding,
 * where a hostile site points its own domain at your machine. Loopback names are
 * always safe: a page on another site cannot make the browser send Host: localhost.
 */
export function isAllowedHost(hostHeader: string | null, config: GuardConfig) {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  if (LOOPBACK_HOSTS.has(hostnameOf(host))) return true;

  const allowed = new Set<string>([new URL(config.appUrl).host.toLowerCase()]);
  for (const entry of (config.allowedHosts ?? "").split(",")) {
    const trimmed = entry.trim().toLowerCase();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed.has(host);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * State-changing requests must come from our own pages. Browsers always send
 * Origin on cross-site POSTs, and Sec-Fetch-Site on modern engines. Without this,
 * any website you visit could POST to your local app.
 */
export function isSameOriginWrite(method: string, headers: Headers) {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;

  const host = headers.get("host")?.toLowerCase();
  const origin = headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }
  if (origin === "null") return false;

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  // No browser signals at all: a non-browser client on this machine (curl, a script).
  return true;
}

export function buildCsp(nonce: string, options: { dev: boolean; https: boolean }) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by Radix positioning; scripts stay nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://kite.zerodha.com",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  if (options.https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
