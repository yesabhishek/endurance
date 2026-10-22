import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Privacy mode blurs anything carrying the `sensitive` class (see globals.css).
// Put the class straight on an element that already holds a figure; use these
// helpers when a figure sits inside other text.

/** A figure that privacy mode blurs. */
export function Sensitive({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("sensitive", className)}>{children}</span>;
}

const UNIT = String.raw`(?:\s?(?:lakh|crore|Cr|L|K)\b)?`;

// Money, percentages, grouped or decimal numbers and long integers. Short whole
// numbers ("top 5", "3 sectors") and years stay readable.
const FIGURE = new RegExp(
  [
    String.raw`[−+-]?₹\s?\d[\d,]*(?:\.\d+)?${UNIT}`,
    String.raw`[−+-]?\d[\d,]*(?:\.\d+)?\s?%`,
    String.raw`\d{1,3}(?:,\d{2,3})+(?:\.\d+)?${UNIT}`,
    String.raw`\d+\.\d+${UNIT}`,
    String.raw`(?<![\d.])(?!(?:19|20)\d{2}(?!\d))\d{4,}(?![\d.])`,
  ].join("|"),
  "g",
);

/** Splits running text so each figure in it is wrapped for privacy mode. */
export function sensitiveText(text: string, keyPrefix = "s"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(FIGURE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(<Sensitive key={`${keyPrefix}-${start}`}>{match[0]}</Sensitive>);
    last = start + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
