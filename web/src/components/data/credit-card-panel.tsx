import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CreditCardSummary } from "@/lib/finance/repositories";
import { currency, percentage, shortDate } from "@/lib/format";

export function CreditCardPanel({ cards }: { cards: CreditCardSummary[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Credit cards</h2>
      {cards.length ? (
        <div className="grid gap-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden rounded-xl border bg-[linear-gradient(135deg,hsl(210_12%_10%),hsl(160_22%_18%))] p-4 text-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-white/65">{card.issuer}</div>
                  <div className="mt-1 text-lg font-semibold tracking-wide">{card.displayName}</div>
                </div>
                <CreditCard className="size-5 text-white/75" aria-hidden="true" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-white/55">Latest signal</div>
                  <div className="mt-1 font-mono text-sm">
                    {card.latestAmount == null ? "Not available" : currency(card.latestAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/55">Last seen</div>
                  <div className="mt-1 font-mono text-sm">{shortDate(card.latestSeenAt)}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Badge className="rounded-md border-white/20 bg-white/10 text-white hover:bg-white/10">
                  {card.sourceCount} records
                </Badge>
                <span className="font-mono text-xs text-white/70">{percentage(card.confidence * 100)} confidence</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">
          No credit cards detected yet. Future Spending Data updates will identify card statements and card-linked
          transactions automatically.
        </div>
      )}
    </section>
  );
}
