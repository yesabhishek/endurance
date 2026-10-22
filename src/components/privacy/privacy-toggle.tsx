"use client";

import { Eye, EyeOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { PRIVACY_COOKIE, PRIVACY_COOKIE_MAX_AGE, PRIVACY_HIDDEN } from "@/lib/privacy";
import { cn } from "@/lib/utils";

// The root layout puts data-privacy="hidden" on <html> when the cookie says so.
// This button flips that attribute and the cookie together, so the choice holds
// across pages and reloads without any client state to hydrate.

const isHidden = () => document.documentElement.dataset.privacy === PRIVACY_HIDDEN;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-privacy"] });
  return () => observer.disconnect();
}

function setHidden(hidden: boolean) {
  if (hidden) document.documentElement.dataset.privacy = PRIVACY_HIDDEN;
  else delete document.documentElement.dataset.privacy;
  document.cookie = `${PRIVACY_COOKIE}=${hidden ? PRIVACY_HIDDEN : "shown"}; path=/; max-age=${PRIVACY_COOKIE_MAX_AGE}; samesite=lax`;
}

const TONES = {
  sidebar: "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
  page: "text-muted-foreground hover:bg-accent hover:text-foreground",
};

/** Hides or shows every figure on screen. `initialHidden` is what the server rendered. */
export function PrivacyToggle({ initialHidden, tone, className }: { initialHidden: boolean; tone: keyof typeof TONES; className?: string }) {
  const hidden = useSyncExternalStore(subscribe, isHidden, () => initialHidden);
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={() => setHidden(!isHidden())}
      aria-pressed={hidden}
      aria-label="Hide numbers"
      title={hidden ? "Show numbers" : "Hide numbers"}
      className={cn("grid size-8 place-items-center rounded-md transition-colors", TONES[tone], className)}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
