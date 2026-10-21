import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/app/page-header";
import { CreditCardPanel } from "@/components/data/credit-card-panel";
import { EmptyState } from "@/components/data/empty-state";
import { ExpenseAnalytics, ExpenseRangeControls } from "@/components/data/expense-analytics";
import { StatGrid } from "@/components/data/stat-grid";
import { TransactionTable } from "@/components/data/transaction-table";
import { requireUserDb } from "@/lib/auth/guard";
import { getExpensesData } from "@/lib/finance/repositories";
import { currency } from "@/lib/format";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const { db } = await requireUserDb();
  const data = await getExpensesData(db, params ?? {});

  return (
    <>
      <PageHeader
        title="Spending"
        description="Track spend, recurring bills, and merchant patterns across the selected date range."
        action={<ExpenseRangeControls range={data.range} />}
      />

      <StatGrid
        stats={[
          { label: "Tracked spend", value: currency(data.analytics.totalSpend, true), hint: `${data.transactions.length} transactions` },
          { label: "Merchants", value: String(data.analytics.merchantBreakdown.length), hint: "In selected range" },
          { label: "Subscriptions", value: currency(data.analytics.subscriptionTotal, true), hint: `${data.analytics.subscriptionCount} active` },
          { label: "Categories", value: String(data.analytics.categoryBreakdown.length), hint: "Expense bifurcation" },
        ]}
      />

      <ExpenseAnalytics range={data.range} analytics={data.analytics} />

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Transactions</h2>
          {data.transactions.length ? (
            <TransactionTable transactions={data.transactions} />
          ) : (
            <EmptyState title="No expenses in this range" detail="Try another date range or update Spending Data from Settings." />
          )}
        </div>

        <aside className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Subscriptions and recurring payments</h2>
            <div className="rounded-lg border">
              {data.recurring.length ? (
                data.recurring.map((item, index) => (
                  <div key={item.id}>
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{item.merchant.name}</div>
                        <Badge variant="outline" className="rounded-md font-mono text-[10px]">
                          {item.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>{item.cadence}</span>
                        <span className="font-mono">{currency(item.amount)}</span>
                      </div>
                    </div>
                    {index < data.recurring.length - 1 ? <Separator /> : null}
                  </div>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">No subscriptions or recurring payments identified.</div>
              )}
            </div>
          </section>

          <CreditCardPanel cards={data.creditCards} />
        </aside>
      </section>
    </>
  );
}
