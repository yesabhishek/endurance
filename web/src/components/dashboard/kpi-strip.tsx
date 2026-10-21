import { cn } from "@/lib/utils";

export type Kpi = { label: string; value: string; sub?: string; tone?: "gain" | "loss" | "muted" };

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-0 flex-col gap-1 p-4 md:p-5",
            index % 2 === 1 && "border-l",
            index >= 2 && "border-t lg:border-t-0",
            index >= 1 && "lg:border-l",
          )}
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("numeral truncate text-[1.6rem] leading-tight md:text-[2rem]", item.tone === "gain" && "text-gain", item.tone === "loss" && "text-loss")}>{item.value}</dd>
          {item.sub ? <dd className={cn("text-sm tabular-nums", item.tone === "gain" ? "text-gain" : item.tone === "loss" ? "text-loss" : "text-muted-foreground")}>{item.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
