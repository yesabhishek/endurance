import type { Slice } from "@/lib/finance/portfolio";
import { inrCompact, inrShort, pct } from "@/lib/format";

// Colour follows the asset class, never its rank, so filters and new syncs don't repaint it.
const CLASS_COLOR: Record<string, string> = {
  Stocks: "var(--chart-1)",
  "Mutual funds": "var(--chart-2)",
  ETFs: "var(--chart-3)",
  Gold: "var(--chart-4)",
  Cash: "var(--chart-5)",
  Other: "var(--chart-6)",
};

/** Part-to-whole across asset classes as one stacked bar, with a labelled legend. */
export function AssetClassBar({ slices }: { slices: Slice[] }) {
  if (!slices.length) return <p className="text-sm text-muted-foreground">Nothing synced yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 gap-0.5" role="img" aria-label={slices.map((slice) => `${slice.label} ${pct(slice.pct)}`).join(", ")}>
        {slices.map((slice, index) => (
          <span
            key={slice.label}
            title={`${slice.label}: ${pct(slice.pct)}, ${inrShort(slice.value)}`}
            className={index === 0 ? "rounded-l" : index === slices.length - 1 ? "rounded-r" : undefined}
            style={{ width: `${slice.pct}%`, minWidth: 3, background: CLASS_COLOR[slice.label] ?? "var(--chart-6)" }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 @md:grid-cols-4">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-start gap-2 text-sm">
            <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-[2px]" style={{ background: CLASS_COLOR[slice.label] ?? "var(--chart-6)" }} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-muted-foreground">{slice.label}</span>
              <span className="font-semibold whitespace-nowrap tabular-nums">
                {pct(slice.pct)} <span className="font-normal text-muted-foreground">{inrCompact(slice.value)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
