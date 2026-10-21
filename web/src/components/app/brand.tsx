import { cn } from "@/lib/utils";

/** Endurance mark: three strokes forming an E, the middle one short. Kite blue. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="24" height="24" rx="6" fill="var(--brand)" />
      <rect x="6" y="6.5" width="12" height="2.4" rx="1.2" fill="#fff" />
      <rect x="6" y="10.8" width="8" height="2.4" rx="1.2" fill="#fff" />
      <rect x="6" y="15.1" width="12" height="2.4" rx="1.2" fill="#fff" />
    </svg>
  );
}

/** "Endurance for Zerodha Kite". The co-brand names the data source; it is not Zerodha's logo. */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark />
      <span className="text-[0.95rem] font-semibold tracking-[-0.01em]">Endurance</span>
      {compact ? null : (
        <span className="hidden items-center gap-2 text-xs text-muted-foreground lg:inline-flex">
          <span className="h-4 w-px bg-border" aria-hidden />
          for Zerodha Kite
        </span>
      )}
    </span>
  );
}
