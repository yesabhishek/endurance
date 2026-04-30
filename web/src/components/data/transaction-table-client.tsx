"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currency, percentage } from "@/lib/format";

export type TransactionTableRow = {
  id: string;
  dateIso: string;
  dateLabel: string;
  merchantName: string;
  category: string;
  instrument: string;
  amount: number;
  direction: string;
  description: string;
  account: string;
  confidence: number;
  reference: string;
  source?: {
    subject: string;
    sentAtLabel: string;
    from: string;
    snippet?: string | null;
  } | null;
};

type SortKey = "date" | "merchant" | "category" | "instrument" | "amount";
type SortDirection = "asc" | "desc";

const columns: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "date", label: "Date" },
  { key: "merchant", label: "Merchant" },
  { key: "category", label: "Category" },
  { key: "instrument", label: "Instrument" },
  { key: "amount", label: "Amount", align: "right" },
];

export function TransactionTableClient({ transactions }: { transactions: TransactionTableRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "date",
    direction: "desc",
  });

  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? transactions.filter((transaction) =>
          [
            transaction.dateLabel,
            transaction.merchantName,
            transaction.category,
            transaction.instrument,
            currency(transaction.amount),
            String(transaction.amount),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : transactions;

    return [...filtered].sort((a, b) => {
      const multiplier = sort.direction === "asc" ? 1 : -1;
      if (sort.key === "amount") return (a.amount - b.amount) * multiplier;
      if (sort.key === "date") return (new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime()) * multiplier;
      return stringValue(a, sort.key).localeCompare(stringValue(b, sort.key)) * multiplier;
    });
  }, [query, sort, transactions]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search transactions"
          className="pl-9"
          placeholder="Search transactions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                  <SortButton
                    active={sort.key === column.key}
                    direction={sort.direction}
                    align={column.align}
                    onClick={() => setSort(nextSort(sort, column.key))}
                  >
                    {column.label}
                  </SortButton>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTransactions.length ? (
              visibleTransactions.map((transaction) => (
                <Sheet key={transaction.id}>
                  <SheetTrigger asChild>
                    <TableRow className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{transaction.dateLabel}</TableCell>
                      <TableCell className="font-medium">{transaction.merchantName}</TableCell>
                      <TableCell>{transaction.category}</TableCell>
                      <TableCell>{transaction.instrument}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {currency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>{transaction.merchantName}</SheetTitle>
                      <SheetDescription>{transaction.description}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 px-4">
                      <div>
                        <div className="text-2xl font-semibold tabular-nums">{currency(transaction.amount)}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-md">
                            {transaction.direction}
                          </Badge>
                          <Badge variant="outline" className="rounded-md">
                            {transaction.category}
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <dl className="grid gap-3 text-sm">
                        <Detail label="Date" value={transaction.dateLabel} />
                        <Detail label="Payment medium" value={transaction.instrument} />
                        <Detail label="Account" value={transaction.account} />
                        <Detail label="Confidence" value={percentage(transaction.confidence * 100)} />
                        <Detail label="Reference" value={transaction.reference} />
                      </dl>

                      {transaction.source ? (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="text-xs font-medium uppercase text-muted-foreground">Supporting record</div>
                            <div className="rounded-lg border p-3 text-sm">
                              <div className="font-medium">{transaction.source.subject}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {transaction.source.sentAtLabel} · {transaction.source.from}
                              </div>
                              {transaction.source.snippet ? (
                                <p className="mt-2 text-xs text-muted-foreground">{transaction.source.snippet}</p>
                              ) : null}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </SheetContent>
                </Sheet>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No transactions match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortButton({
  active,
  direction,
  align,
  children,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  align?: "right";
  children: ReactNode;
  onClick: () => void;
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className={[
        "inline-flex w-full items-center gap-1.5 rounded-sm text-left font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        align === "right" ? "justify-end" : "justify-start",
        active ? "text-foreground" : "text-muted-foreground",
      ].join(" ")}
      onClick={onClick}
    >
      <span>{children}</span>
      <Icon className="size-3.5" />
    </button>
  );
}

function nextSort(current: { key: SortKey; direction: SortDirection }, key: SortKey) {
  if (current.key !== key) return { key, direction: key === "date" || key === "amount" ? "desc" : "asc" } as const;
  return { key, direction: current.direction === "asc" ? "desc" : "asc" } as const;
}

function stringValue(transaction: TransactionTableRow, key: SortKey) {
  if (key === "merchant") return transaction.merchantName;
  if (key === "category") return transaction.category;
  if (key === "instrument") return transaction.instrument;
  return "";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[220px] text-right font-medium break-words">{value}</dd>
    </div>
  );
}
