"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

// Charts hand a question to a fresh chat through sessionStorage, so the question
// never ends up in a URL, browser history or server logs.

const KEY = "endurance:ask";

/** Fired when a chat finishes a turn, so the sidebar can list it without a reload. */
export const CHAT_SAVED_EVENT = "endurance:chat-saved";

export function useAsk() {
  const router = useRouter();
  return useCallback(
    (question: string) => {
      try {
        sessionStorage.setItem(KEY, question);
      } catch {
        // Storage blocked: the chat just opens empty.
      }
      router.push("/");
    },
    [router],
  );
}

export function takePendingQuestion() {
  try {
    const question = sessionStorage.getItem(KEY);
    if (question) sessionStorage.removeItem(KEY);
    return question;
  } catch {
    return null;
  }
}
