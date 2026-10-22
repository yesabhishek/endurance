import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { FinanceTools } from "./ai/tools";
import { listJson, readJson, removeJson, writeJson } from "./store";

// Conversations live in .data/chats/<id>.json in the AI SDK's UI message format,
// tool results included, so the sources behind every answer survive a reload.

export type ChatMessage = UIMessage<{ model?: string; createdAt?: string }, UIDataTypes, InferUITools<FinanceTools>>;

export type ChatRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type ChatSummary = Omit<ChatRecord, "messages">;

export const CHAT_ID = /^[A-Za-z0-9_-]{8,40}$/;

const file = (id: string) => {
  if (!CHAT_ID.test(id)) throw new Error("Invalid chat id");
  return `chats/${id}.json`;
};

export async function loadChat(id: string) {
  if (!CHAT_ID.test(id)) return null;
  return readJson<ChatRecord>(file(id));
}

function titleFrom(messages: ChatMessage[]) {
  const first = messages.find((message) => message.role === "user");
  const text = first?.parts.map((part) => (part.type === "text" ? part.text : "")).join(" ").replace(/\s+/g, " ").trim() ?? "";
  return text.length > 72 ? `${text.slice(0, 70).trimEnd()}…` : text || "New chat";
}

const INDEX = "chat-index.json";

const summarize = (record: ChatRecord): ChatSummary => ({ id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt });

async function readIndex(): Promise<ChatSummary[]> {
  const index = await readJson<ChatSummary[]>(INDEX);
  if (index) return index;
  // First run, or the index was deleted: rebuild it from the chat files.
  const files = await listJson("chats");
  const records = await Promise.all(files.map((name) => readJson<ChatRecord>(name).catch(() => null)));
  const rebuilt = records.filter((record): record is ChatRecord => Boolean(record?.id)).map(summarize);
  await writeJson(INDEX, rebuilt);
  return rebuilt;
}

export async function saveChat(id: string, messages: ChatMessage[]) {
  const existing = await loadChat(id);
  const now = new Date().toISOString();
  const record: ChatRecord = {
    id,
    title: existing?.title ?? titleFrom(messages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages,
  };
  await writeJson(file(id), record);
  await writeJson(INDEX, [summarize(record), ...(await readIndex()).filter((entry) => entry.id !== id)]);
}

export async function deleteChat(id: string) {
  await removeJson(file(id));
  await writeJson(INDEX, (await readIndex()).filter((entry) => entry.id !== id));
}

/** Newest first. */
export async function listChats(limit = 50): Promise<ChatSummary[]> {
  return (await readIndex()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
