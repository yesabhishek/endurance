import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { aiConfig } from "@/lib/ai/provider";
import { loadChat } from "@/lib/chats";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const chat = await loadChat((await params).id);
  return { title: chat?.title ?? "Chat" };
}

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = await loadChat(id);
  if (!chat) notFound();
  const ai = aiConfig();
  return (
    <Chat
      key={id}
      id={id}
      initialMessages={chat.messages}
      ai={{ ready: ai.ok, label: ai.ok ? `${ai.label} · ${ai.model}` : null, problem: ai.ok ? null : ai.problem }}
    />
  );
}
