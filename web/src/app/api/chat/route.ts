import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { buildChatContext } from "@/lib/finance/repositories";
import { callKiteTool } from "@/lib/kite/mcp";

export const runtime = "nodejs";

const SYSTEM = `You are Endurance, a read-only personal finance analyst.
Rules:
- Never place orders, modify orders, cancel orders, transfer money, or claim that you can.
- Use the provided tools and local context for facts. Cite user-facing source areas such as expenses, recurring bills, holdings, or source records.
- Distinguish observed data from assumptions.
- Give technically and financially aligned analysis: calculations, concentration, recurring spend, risk, cash-flow, and caveats.
- When discussing investments, include that this is not financial advice.
- If data is missing, say exactly whether Spending Data or Investment Data needs to be connected or updated.`;

type ChatRequest = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const messages = body.messages.slice(-12);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  const db = getDb();
  const thread = await db.chatThread.upsert({
    where: { id: "local" },
    update: {},
    create: { id: "local", title: "Finance chat" },
  });

  if (lastUserMessage) {
    await db.chatMessage.create({
      data: { threadId: thread.id, role: "user", content: lastUserMessage.content },
    });
  }

  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
    const context = await buildChatContext();
    const text = fallbackAnswer(lastUserMessage?.content ?? "", context);
    await db.chatMessage.create({ data: { threadId: thread.id, role: "assistant", content: text } });
    return textResponse(text);
  }

  const context = await buildChatContext();
  const result = streamText({
    model: process.env.AI_MODEL ?? "openai/gpt-5.4",
    system: `${SYSTEM}\n\nCurrent local context snapshot:\n${JSON.stringify(context, null, 2).slice(0, 12000)}`,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })) as ModelMessage[],
    stopWhen: stepCountIs(5),
    tools: {
      queryExpenses: tool({
        description: "Read recent normalized expenses and merchant data from the local SQLite database.",
        inputSchema: z.object({ limit: z.number().min(1).max(100).default(30) }),
        execute: async ({ limit }) => {
          return db.transaction.findMany({
            include: { merchant: true, emailSource: true },
            orderBy: { transactionDate: "desc" },
            take: limit,
          });
        },
      }),
      queryRecurringPayments: tool({
        description: "Read detected subscriptions and recurring payments.",
        inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
        execute: async ({ limit }) => {
          return db.recurringPayment.findMany({
            include: { merchant: true },
            orderBy: { lastSeenAt: "desc" },
            take: limit,
          });
        },
      }),
      queryInvestments: tool({
        description: "Read normalized stock, mutual fund, gold, ETF, and other holdings.",
        inputSchema: z.object({ limit: z.number().min(1).max(100).default(50) }),
        execute: async ({ limit }) => {
          return db.holding.findMany({
            include: { account: true },
            orderBy: { currentValue: "desc" },
            take: limit,
          });
        },
      }),
      queryEmailEvidence: tool({
        description: "Read recent source records that support expense and bill detection.",
        inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
        execute: async ({ limit }) => {
          return db.parsedFinancialEmail.findMany({
            include: { emailSource: true },
            orderBy: { createdAt: "desc" },
            take: limit,
          });
        },
      }),
      queryMarket: tool({
        description: "Read market quotes through the connected investment data source.",
        inputSchema: z.object({ instruments: z.array(z.string()).min(1).max(20) }),
        execute: async ({ instruments }) => callKiteTool("get_quotes", { instruments }),
      }),
    },
    onFinish: async ({ text }) => {
      await db.chatMessage.create({ data: { threadId: thread.id, role: "assistant", content: text } });
    },
  });

  return result.toTextStreamResponse();
}

function textResponse(text: string) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}

function fallbackAnswer(question: string, context: Awaited<ReturnType<typeof buildChatContext>>) {
  const spend = context.transactions.reduce((sum, item) => sum + Number(item.amount), 0);
  const value = context.holdings.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0);
  const recurring = context.recurring.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return [
    "AI Gateway credentials are not configured, so this is a deterministic local summary instead of an LLM answer.",
    "",
    `Question: ${question || "No question supplied."}`,
    "",
    `Observed data: ${context.transactions.length} expenses total ${spend.toFixed(2)} INR, ${context.holdings.length} holdings total ${value.toFixed(2)} INR, and ${context.recurring.length} recurring bills total ${recurring.toFixed(2)} INR.`,
    "Sources: expenses, holdings, recurring bills, and supporting source records.",
    "No actions were taken. Investment discussion is informational only and not financial advice.",
  ].join("\n");
}
