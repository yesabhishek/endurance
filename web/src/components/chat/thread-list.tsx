"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThreadList({ threads, activeId }: { threads: Array<{ id: string; title: string }>; activeId: string | null }) {
  const router = useRouter();

  async function remove(id: string) {
    const response = await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (id === activeId) router.replace("/chat");
      router.refresh();
    }
  }

  if (!threads.length) return <p className="text-sm text-muted-foreground">No conversations yet.</p>;

  return (
    <ul className="flex flex-col gap-0.5">
      {threads.map((thread) => (
        <li key={thread.id} className="group flex items-center gap-1">
          <Link
            href={`/chat?thread=${thread.id}`}
            className={cn("min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground", thread.id === activeId && "bg-muted text-foreground")}
            title={thread.title}
          >
            {thread.title}
          </Link>
          <button type="button" onClick={() => remove(thread.id)} aria-label={`Delete ${thread.title}`} className="rounded p-1 text-muted-foreground opacity-0 hover:text-loss focus:opacity-100 group-hover:opacity-100">
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
