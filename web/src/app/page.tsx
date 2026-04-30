import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/data/empty-state";
import { HoldingTable } from "@/components/data/holding-table";
import { SetupChecklist } from "@/components/data/setup-checklist";
import { StatGrid } from "@/components/data/stat-grid";
import { TransactionTable } from "@/components/data/transaction-table";
import { getFinancialOverview } from "@/lib/finance/repositories";
import { currency, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getFinancialOverview();

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Financial control surface"
        description="A private workspace for expenses, bills, investments, and read-only financial analysis."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">
                <RefreshCw className="size-3.5" />
                Update data
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/chat">Ask finance chat</Link>
            </Button>
          </div>
        }
      />

      {!data.hasAnySource ? (
        <SetupChecklist spendingConnected={data.hasSpendingData} investmentConnected={data.hasInvestmentData} />
      ) : (
        <>
          {(!data.hasSpendingData || !data.hasInvestmentData) ? (
            <SetupChecklist
              spendingConnected={data.hasSpendingData}
              investmentConnected={data.hasInvestmentData}
              compact
            />
          ) : null}

      <StatGrid
        stats={[
          { label: "Month spend", value: currency(data.expenseTotal, true), hint: "Tracked transactions" },
          { label: "Portfolio value", value: currency(data.portfolioValue, true), hint: "Current holdings" },
          {
            label: "Unrealized P&L",
            value: currency(data.portfolioPnl, true),
            hint: "Latest portfolio view",
            tone: data.portfolioPnl >= 0 ? "positive" : "negative",
          },
          { label: "Recurring monthly", value: currency(data.recurringTotal, true), hint: "Bills and subscriptions" },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent transactions</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/expenses">View all</Link>
            </Button>
          </div>
          {data.transactions.length ? (
            <TransactionTable transactions={data.transactions} />
          ) : (
            <EmptyState title="No expenses yet" detail="Connect Spending Data and run an update from Settings." />
          )}
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">Recent updates</h2>
          <div className="rounded-lg border">
            {data.lastSyncs.length ? (
              data.lastSyncs.map((sync, index) => (
                <div key={sync.id}>
                  <div className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <div className="font-medium">{sync.source === "GMAIL" ? "Spending Data" : "Investment Data"}</div>
                      <div className="text-xs text-muted-foreground">{shortDate(sync.startedAt)}</div>
                    </div>
                    <div className="font-mono text-xs">{sync.status}</div>
                  </div>
                  {index < data.lastSyncs.length - 1 ? <Separator /> : null}
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No updates have run yet.</div>
            )}
          </div>
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Top holdings</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/investments">View all</Link>
          </Button>
        </div>
        {data.holdings.length ? (
          <HoldingTable holdings={data.holdings} />
        ) : (
          <EmptyState title="No investments yet" detail="Connect Investment Data and run an update from Settings." />
        )}
      </section>
        </>
      )}
    </>
  );
}
