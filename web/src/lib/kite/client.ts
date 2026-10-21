import { createHash } from "node:crypto";
import { z } from "zod";

// Minimal, read-only Kite Connect v3 client. It never calls order endpoints.
// Docs: https://kite.trade/docs/connect/v3/

export const KITE_LOGIN_URL = "https://kite.zerodha.com/connect/login";
const KITE_API = "https://api.kite.trade";
const TIMEOUT_MS = 15_000;

export class KiteError extends Error {
  constructor(
    message: string,
    public errorType: string | null,
    public status: number,
  ) {
    super(message);
  }

  /** Kite tokens expire every morning; the user must log in again. */
  get isTokenExpired() {
    return this.errorType === "TokenException" || this.status === 403;
  }
}

const envelopeSchema = z.object({
  status: z.string(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error_type: z.string().optional(),
});

async function kiteRequest(path: string, init: RequestInit & { apiKey: string; accessToken?: string }) {
  const headers = new Headers(init.headers);
  headers.set("X-Kite-Version", "3");
  headers.set("User-Agent", "endurance-portfolio");
  if (init.accessToken) headers.set("Authorization", `token ${init.apiKey}:${init.accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${KITE_API}${path}`, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (error) {
    throw new KiteError(`Kite could not be reached (${error instanceof Error ? error.name : "network error"}).`, "NetworkException", 0);
  }

  const parsed = envelopeSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new KiteError(`Kite returned an unreadable response (HTTP ${response.status}).`, null, response.status);

  const body = parsed.data;
  if (!response.ok || body.status !== "success") {
    throw new KiteError(body.message || `Kite request failed (HTTP ${response.status}).`, body.error_type ?? null, response.status);
  }
  return body.data;
}

export function kiteLoginUrl(apiKey: string, state: string) {
  const url = new URL(KITE_LOGIN_URL);
  url.searchParams.set("v", "3");
  url.searchParams.set("api_key", apiKey);
  // Kite returns redirect_params untouched on the callback; we use it for the CSRF state.
  url.searchParams.set("redirect_params", new URLSearchParams({ state }).toString());
  return url.toString();
}

const sessionSchema = z.object({
  access_token: z.string().min(1),
  user_id: z.string(),
  user_name: z.string().optional(),
  user_shortname: z.string().optional(),
  email: z.string().optional(),
});

/** Exchanges the one-time request_token for an access token. The secret never leaves the server. */
export async function exchangeRequestToken(apiKey: string, apiSecret: string, requestToken: string) {
  const checksum = createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
  const data = await kiteRequest("/session/token", {
    method: "POST",
    apiKey,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }).toString(),
  });
  const session = sessionSchema.parse(data);
  return {
    accessToken: session.access_token,
    kiteUserId: session.user_id,
    displayName: session.user_name ?? session.user_shortname ?? session.user_id,
  };
}

/** Ends the Kite session on Zerodha's side. Best effort. */
export async function invalidateAccessToken(apiKey: string, accessToken: string) {
  const query = new URLSearchParams({ api_key: apiKey, access_token: accessToken });
  await kiteRequest(`/session/token?${query}`, { method: "DELETE", apiKey, accessToken }).catch(() => undefined);
}

const num = z.coerce.number().catch(0);
const optNum = z.coerce.number().nullable().optional().catch(null);

export const kiteHoldingSchema = z.object({
  tradingsymbol: z.string(),
  exchange: z.string().optional(),
  isin: z.string().optional(),
  quantity: num,
  t1_quantity: num.optional(),
  average_price: optNum,
  last_price: optNum,
  close_price: optNum,
  pnl: optNum,
  day_change: optNum,
});

export const kiteMfHoldingSchema = z.object({
  tradingsymbol: z.string(),
  fund: z.string().optional(),
  folio: z.string().nullable().optional(),
  quantity: num,
  average_price: optNum,
  last_price: optNum,
  pnl: optNum,
});

export const kitePositionSchema = z.object({
  tradingsymbol: z.string(),
  exchange: z.string().optional(),
  product: z.string().optional(),
  quantity: num,
  average_price: optNum,
  last_price: optNum,
  pnl: optNum,
});

const profileSchema = z.object({ user_id: z.string(), user_name: z.string().optional() });

export type KiteHolding = z.infer<typeof kiteHoldingSchema>;
export type KiteMfHolding = z.infer<typeof kiteMfHoldingSchema>;
export type KitePosition = z.infer<typeof kitePositionSchema>;

export function kiteApi(apiKey: string, accessToken: string) {
  const get = (path: string) => kiteRequest(path, { method: "GET", apiKey, accessToken });
  return {
    profile: async () => profileSchema.parse(await get("/user/profile")),
    holdings: async () => z.array(kiteHoldingSchema).parse(await get("/portfolio/holdings")),
    mfHoldings: async () => z.array(kiteMfHoldingSchema).parse(await get("/mf/holdings")),
    positions: async () => {
      const data = z.object({ net: z.array(kitePositionSchema).default([]) }).parse(await get("/portfolio/positions"));
      return data.net.filter((position) => position.quantity !== 0);
    },
  };
}

/**
 * Kite flushes access tokens every morning between about 06:00 and 07:30 IST.
 * We treat 06:00 IST as the expiry so the app asks for a fresh login in time.
 */
export function nextKiteExpiry(now = new Date()) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const expiry = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 6, 0, 0) - IST_OFFSET_MS;
  return new Date(expiry > now.getTime() ? expiry : expiry + 24 * 60 * 60 * 1000);
}
