import type { EmailSource, Merchant, Transaction } from "@prisma/client";
import { shortDate } from "@/lib/format";
import { TransactionTableClient, type TransactionTableRow } from "./transaction-table-client";

type TransactionWithMerchant = Transaction & {
  merchant?: Merchant | null;
  emailSource?: Pick<EmailSource, "accountEmail" | "fromAddress" | "fromName" | "subject" | "sentAt" | "snippet"> | null;
};

export function TransactionTable({ transactions }: { transactions: TransactionWithMerchant[] }) {
  return <TransactionTableClient transactions={transactions.map(toTransactionRow)} />;
}

function toTransactionRow(transaction: TransactionWithMerchant): TransactionTableRow {
  return {
    id: transaction.id,
    dateIso: transaction.transactionDate.toISOString(),
    dateLabel: shortDate(transaction.transactionDate),
    merchantName: transaction.merchant?.name ?? "Unknown",
    category: transaction.category ?? "Uncategorized",
    instrument: transaction.paymentInstrument ?? "—",
    amount: Number(transaction.amount),
    direction: transaction.direction,
    description: transaction.description ?? "Recorded transaction",
    account: transaction.emailSource?.accountEmail ?? "Not identified",
    confidence: Number(transaction.confidence ?? 0),
    reference: transaction.externalId ?? transaction.id,
    source: transaction.emailSource
      ? {
          subject: transaction.emailSource.subject,
          sentAtLabel: shortDate(transaction.emailSource.sentAt),
          from: transaction.emailSource.fromName ?? transaction.emailSource.fromAddress ?? "Unknown source",
          snippet: transaction.emailSource.snippet,
        }
      : null,
  };
}
