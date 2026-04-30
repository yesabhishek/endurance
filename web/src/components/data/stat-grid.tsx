import { Badge } from "@/components/ui/badge";

type Stat = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
};

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            {stat.tone && stat.tone !== "default" ? (
              <Badge variant="outline" className="h-5 rounded-md px-1.5 font-mono text-[10px]">
                {stat.tone}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 font-mono text-lg font-semibold tabular-nums">{stat.value}</div>
          {stat.hint ? <div className="mt-1 text-xs text-muted-foreground">{stat.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
