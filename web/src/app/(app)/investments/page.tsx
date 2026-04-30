import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { HoldingTable } from "@/components/data/holding-table";
import { InvestmentAnalytics } from "@/components/data/investment-analytics";
import { StatGrid } from "@/components/data/stat-grid";
import { getInvestmentsData } from "@/lib/finance/repositories";
import { currency, percentage, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const data = await getInvestmentsData();
  const mfCount = data.holdings.filter((item) => item.assetClass === "MUTUAL_FUND").length;
  const stockCount = data.holdings.filter((item) => item.assetClass === "STOCK").length;

  return (
    <>
      <PageHeader
        eyebrow="Investments"
        title="Portfolio analytics"
        description="Review holdings, asset allocation, and unrealized gains."
      />

      <StatGrid
        stats={[
          { label: "Portfolio value", value: currency(data.analytics.totalValue, true), hint: `${data.holdings.length} holdings` },
          {
            label: "Unrealized P&L",
            value: currency(data.analytics.totalPnl, true),
            hint: percentage(data.analytics.pnlPct),
            tone: data.analytics.totalPnl >= 0 ? "positive" : "negative",
          },
          { label: "Stocks", value: String(stockCount), hint: "Direct equity holdings" },
          { label: "Mutual funds", value: String(mfCount), hint: "Fund holdings" },
        ]}
      />

      <InvestmentAnalytics analytics={data.analytics} />

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Holdings</h2>
          {data.holdings.length ? (
            <HoldingTable holdings={data.holdings} />
          ) : (
            <EmptyState title="No investments yet" detail="Connect Investment Data and run an update from Settings." />
          )}
        </div>

        <aside className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Accounts</h2>
            <div className="rounded-lg border">
              {data.accounts.length ? (
                data.accounts.map((account, index) => (
                  <div key={account.id}>
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{account.accountName ?? account.provider}</div>
                        <Badge variant="outline" className="rounded-md font-mono text-[10px]">
                          CONNECTED
                        </Badge>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {account.accountRef ?? "default"}
                      </div>
                    </div>
                    {index < data.accounts.length - 1 ? <Separator /> : null}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No investment accounts yet.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Recent valuation points</h2>
            <div className="rounded-lg border">
              {data.snapshots.length ? (
                data.snapshots.slice(0, 12).map((snapshot, index) => (
                  <div key={snapshot.id}>
                    <div className="p-3">
                      <div className="flex justify-between gap-3">
                        <div className="truncate font-medium">{snapshot.holding.name}</div>
                        <div className="font-mono text-xs">{currency(snapshot.value)}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {shortDate(snapshot.capturedAt)}
                      </div>
                    </div>
                    {index < Math.min(data.snapshots.length, 12) - 1 ? <Separator /> : null}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No snapshots captured yet.</div>
              )}
            </div>
          </section>
        </aside>
      </section>
    </>
  );
}
