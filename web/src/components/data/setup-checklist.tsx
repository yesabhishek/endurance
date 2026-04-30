import Link from "next/link";
import { CheckCircle2, Circle, Landmark, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SetupChecklistProps = {
  spendingConnected: boolean;
  investmentConnected: boolean;
  compact?: boolean;
};

export function SetupChecklist({ spendingConnected, investmentConnected, compact = false }: SetupChecklistProps) {
  const items = [
    {
      title: "Connect Spending Data",
      detail: "Track expenses, recurring bills, and merchant patterns.",
      href: "/settings",
      connected: spendingConnected,
      icon: WalletCards,
    },
    {
      title: "Connect Investment Data",
      detail: "Track holdings, allocation, and unrealized gains.",
      href: "/settings",
      connected: investmentConnected,
      icon: Landmark,
    },
  ];

  return (
    <section className={cn("rounded-lg border", compact ? "p-3" : "p-5")}>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Finish setup</h2>
        <p className="text-sm text-muted-foreground">
          Connect at least one data source to continue into the app.
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          const Status = item.connected ? CheckCircle2 : Circle;
          return (
            <div key={item.title} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
                <Status className={cn("size-4 shrink-0", item.connected && "text-emerald-600")} />
              </div>
              <Button asChild size="sm" variant={item.connected ? "outline" : "default"} className="mt-4">
                <Link href={item.href}>{item.connected ? "Manage" : "Connect"}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
