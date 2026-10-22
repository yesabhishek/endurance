"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/30"
    >
      {copied ? <Check className="size-3.5 text-gain" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
