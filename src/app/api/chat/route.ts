import { convertToModelMessages, createIdGenerator, isToolUIPart, stepCountIs, streamText, validateUIMessages, type ModelMessage } from "ai";
import { z } from "zod";
import { aiConfig, languageModel } from "@/lib/ai/provider";
import { systemPrompt } from "@/lib/ai/prompt";
import { buildTools } from "@/lib/ai/tools";
import { CHAT_ID, loadChat, saveChat, type ChatMessage } from "@/lib/chats";
import { isDemo, limits } from "@/lib/config";
import { getHistory, getPortfolioData } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  id: z.string().regex(CHAT_ID),
  message: z.object({
    id: z.string().min(1).max(64),
    role: z.literal("user"),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(4000) })).length(1),
  }),
});

/** Highest S-number already used in this thread, so new sources keep counting up. */
function lastRef(messages: ChatMessage[]) {
  let max = 0;
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      const ref = (part.output as { source?: { ref?: string } } | undefined)?.source?.ref;
      const n = Number(ref?.replace(/^S/, ""));
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return max;
}

const textOf = (message: ChatMessage) => message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");

function friendlyError(error: unknown, model: string) {
  const message = error instanceof Error ? error.message : String(error);
  if (/api key|unauthori[sz]ed|401|invalid.*key|authentication/i.test(message)) return "Your AI provider rejected the key in .env. Check it and restart Endurance.";
  if (/model/i.test(message) && /not found|does not exist|unsupported|invalid/i.test(message)) return `The model "${model}" isn't available for your key. Change AI_MODEL in .env and restart.`;
  if (/quota|rate limit|429|credit|billing/i.test(message)) return "Your AI provider says you've hit a usage limit or run out of credit.";
  return "The AI provider returned an error. Try again in a moment.";
}

export async function POST(request: Request) {
  const ai = aiConfig();
  if (!ai.ok) return Response.json({ error: ai.problem }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Type a question (up to 4,000 characters)." }, { status: 400 });
  const { id, message } = parsed.data;

  const existing = (await loadChat(id))?.messages ?? [];
  let refs = lastRef(existing);
  const tools = buildTools({
    load: () => getPortfolioData(),
    history: getHistory,
    limits: limits(),
    nextRef: () => `S${++refs}`,
  });

  let messages: ChatMessage[];
  try {
    messages = await validateUIMessages<ChatMessage>({ messages: [...existing, message as ChatMessage], tools });
  } catch {
    // A saved chat from an older version no longer matches the tools; keep going without its history.
    messages = [message as ChatMessage];
  }

  // Earlier turns go to the model as plain text: no old tool data (it fetches fresh data for each
  // question) and no provider-specific reasoning items, which some APIs refuse to see without context.
  const earlier: ModelMessage[] = messages
    .slice(0, -1)
    .slice(-10)
    .map((entry) => ({ role: entry.role === "user" ? ("user" as const) : ("assistant" as const), content: textOf(entry) }))
    .filter((entry) => entry.content.trim());
  const modelMessages: ModelMessage[] = [...earlier, ...(await convertToModelMessages([messages.at(-1)!], { tools }))];

  const result = streamText({
    model: languageModel(ai),
    system: systemPrompt(limits(), { demo: isDemo() }),
    messages: modelMessages,
    tools,
    // Look at the data before saying anything.
    prepareStep: ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" } : undefined),
    stopWhen: stepCountIs(8),
    onError: ({ error }) => console.error("[chat] model error:", error instanceof Error ? error.message : error),
  });

  return result.toUIMessageStreamResponse<ChatMessage>({
    originalMessages: messages,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
    messageMetadata: ({ part }) => (part.type === "start" ? { model: `${ai.label} · ${ai.model}`, createdAt: new Date().toISOString() } : undefined),
    onFinish: async ({ messages: finished }) => {
      await saveChat(id, finished).catch((error) => console.error("[chat] could not save", error));
    },
    onError: (error) => friendlyError(error, ai.model),
    headers: { "Cache-Control": "no-store" },
  });
}
