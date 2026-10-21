import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FinanceChat, type ChatMessage } from "@/components/chat/finance-chat";
import { ThreadList } from "@/components/chat/thread-list";
import { PROVIDERS } from "@/lib/ai/providers";
import { requireUserDb } from "@/lib/auth/guard";
import { isAiKind } from "@/lib/credentials";
import { getPortfolio } from "@/lib/finance/portfolio";
import { portfolioSuggestions } from "@/lib/finance/suggestions";

export const metadata: Metadata = { title: "Ask" };
export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { user, db } = await requireUserDb();

  const [settings, threads, credentialKinds, portfolio] = await Promise.all([
    db.userSettings.findUnique({ where: { userId: user.id } }),
    db.chatThread.findMany({ orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } }),
    db.credential.findMany({ select: { kind: true } }),
    getPortfolio(db, user.id),
  ]);

  const thread = params.thread ? await db.chatThread.findUnique({ where: { id: params.thread }, select: { id: true } }) : null;
  const stored = thread
    ? await db.chatMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: "asc" }, take: 200 })
    : [];

  const initialMessages: ChatMessage[] = stored.map((message) => {
    let tools: string[] | undefined;
    try {
      tools = message.metadataJson ? (JSON.parse(message.metadataJson) as { tools?: string[] }).tools : undefined;
    } catch {
      tools = undefined;
    }
    return {
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text: message.content }],
      metadata: { tools },
    };
  });

  const provider = settings?.chatProvider && isAiKind(settings.chatProvider) ? settings.chatProvider : null;
  const ready = Boolean(provider && settings?.chatModel && credentialKinds.some((c) => c.kind === provider));

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3">
        <Link href="/chat" className="inline-flex h-9 w-fit items-center gap-2 rounded-md border bg-card px-3 text-sm hover:border-brand">
          <Plus className="size-4" aria-hidden /> New conversation
        </Link>
        <ThreadList threads={threads.map((t) => ({ id: t.id, title: t.title }))} activeId={thread?.id ?? null} />
      </aside>
      <FinanceChat
        key={thread?.id ?? "new"}
        threadId={thread?.id ?? null}
        initialMessages={initialMessages}
        ready={ready}
        consentGiven={Boolean(settings?.aiDataConsentAt)}
        providerLabel={provider ? PROVIDERS[provider].label : null}
        model={settings?.chatModel ?? null}
        initialQuestion={!thread && params.q ? params.q.slice(0, 4000) : null}
        suggestions={portfolioSuggestions(portfolio)}
      />
    </div>
  );
}
