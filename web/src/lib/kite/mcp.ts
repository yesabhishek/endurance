import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const READ_ONLY_TOOLS = new Set([
  "get_profile",
  "get_margins",
  "get_holdings",
  "get_positions",
  "get_mf_holdings",
  "get_quotes",
  "get_ltp",
  "get_ohlc",
  "get_historical_data",
]);

const SETUP_TOOLS = new Set(["login"]);

export async function callKiteTool(
  toolName: string,
  args: Record<string, unknown> = {},
  sessionId?: string | null,
) {
  if (!READ_ONLY_TOOLS.has(toolName) && !SETUP_TOOLS.has(toolName)) {
    throw new Error("This investment data operation is not available in read-only mode.");
  }

  const url = process.env.KITE_MCP_URL ?? "http://localhost:8080/mcp";
  const client = new Client({ name: "endurance-web", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    sessionId: sessionId ?? undefined,
  });

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: toolName, arguments: args });
    return {
      data: parseMcpResult(result),
      sessionId: transport.sessionId,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function getKiteLoginLink(sessionId?: string | null) {
  let result: Awaited<ReturnType<typeof callKiteTool>>;

  try {
    result = await callKiteTool("login", {}, sessionId);
  } catch (error) {
    if (sessionId && isInvalidMcpSessionError(error)) {
      result = await callKiteTool("login", {});
    } else {
      throw error;
    }
  }

  const text = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  const loginUrl = text.match(/https:\/\/kite\.zerodha\.com\/connect\/login\?[^)\s]+/)?.[0];
  if (!loginUrl && isKiteAlreadyLoggedIn(text)) {
    return {
      loginUrl: null,
      sessionId: result.sessionId,
      alreadyLoggedIn: true,
    };
  }

  if (!loginUrl) {
    throw new Error("Investment Data login could not be started. Check the connector service and try again.");
  }

  return {
    loginUrl,
    sessionId: result.sessionId,
    alreadyLoggedIn: false,
  };
}

export function parseMcpResult(result: unknown) {
  if (!result || typeof result !== "object" || !("content" in result)) {
    return result;
  }

  const content = (result as { content?: Array<{ type?: string; text?: string }> }).content ?? [];
  const text = content.find((item) => item.type === "text")?.text;
  if (!text) return result;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function asArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as { data?: unknown[] }).data)) {
    return (value as { data: unknown[] }).data;
  }
  if (value && typeof value === "object" && Array.isArray((value as { holdings?: unknown[] }).holdings)) {
    return (value as { holdings: unknown[] }).holdings;
  }
  return [];
}

export function isMcpAuthRequired(value: unknown) {
  return typeof value === "string" && /log in first|login tool|auth/i.test(value);
}

export function isInvalidMcpSessionError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /invalid session id|session.*not found|code:\s*400|streamable http error/i.test(text);
}

export function isKiteAlreadyLoggedIn(value: unknown) {
  return typeof value === "string" && /already logged in as/i.test(value);
}
