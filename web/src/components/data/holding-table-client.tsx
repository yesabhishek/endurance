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

export type HoldingTableRow = {
  id: string;
  name: string;
  symbol: string;
  assetClass: string;
  quantity: string;
  averagePrice: number;
  lastPrice: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  account: string;
  updatedLabel: string;
  updatedIso: string;
};

type SortKey = "asset" | "class" | "quantity" | "value" | "pnl" | "updated";
type SortDirection = "asc" | "desc";

const columns: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "asset", label: "Asset" },
  { key: "class", label: "Class" },
  { key: "quantity", label: "Qty", align: "right" },
  { key: "value", label: "Value", align: "right" },
  { key: "pnl", label: "P&L", align: "right" },
  { key: "updated", label: "Updated" },
];

export function HoldingTableClient({ holdings }: { holdings: HoldingTableRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "value",
    direction: "desc",
  });

  const visibleHoldings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? holdings.filter((holding) =>
          [holding.name, holding.symbol, holding.assetClass, holding.account, currency(holding.currentValue), String(holding.currentValue)]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : holdings;

    return [...filtered].sort((a, b) => compareHolding(a, b, sort.key) * (sort.direction === "asc" ? 1 : -1));
  }, [holdings, query, sort]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search holdings"
          className="pl-9"
          placeholder="Search holdings"
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
            {visibleHoldings.length ? (
              visibleHoldings.map((holding) => {
                const tone = impactTone(holding.pnl);
                return (
                  <Sheet key={holding.id}>
                    <SheetTrigger asChild>
                      <TableRow className={`cursor-pointer border-l-2 hover:bg-muted/50 ${tone.row}`}>
                        <TableCell>
                          <div className="text-base font-semibold leading-tight">{holding.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{holding.symbol}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-md font-mono text-[10px]">
                            {holding.assetClass}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{holding.quantity}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {currency(holding.currentValue)}
                        </TableCell>
                        <TableCell className={`text-right font-mono tabular-nums ${tone.text}`}>
                          {currency(holding.pnl)} · {percentage(holding.pnlPct)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{holding.updatedLabel}</TableCell>
                      </TableRow>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md">
                      <SheetHeader>
                        <SheetTitle>{holding.name}</SheetTitle>
                        <SheetDescription>{holding.symbol}</SheetDescription>
                      </SheetHeader>
                      <div className="space-y-4 px-4">
                        <div>
                          <div className="text-2xl font-semibold tabular-nums">{currency(holding.currentValue)}</div>
                          <div className={`mt-1 text-sm font-medium ${tone.text}`}>
                            {currency(holding.pnl)} · {percentage(holding.pnlPct)}
                          </div>
                        </div>

                        <Separator />

                        <dl className="grid gap-3 text-sm">
                          <Detail label="Asset class" value={holding.assetClass} />
                          <Detail label="Quantity" value={holding.quantity} />
                          <Detail label="Average price" value={currency(holding.averagePrice)} />
                          <Detail label="Last price" value={currency(holding.lastPrice)} />
                          <Detail label="Sector" value={holding.account} />
                          <Detail label="Updated" value={holding.updatedLabel} />
                        </dl>
                      </div>
                    </SheetContent>
                  </Sheet>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  No holdings match your search.
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
        "inline-flex w-full items-center gap-1.5 rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        align === "right" ? "justify-end text-right" : "justify-start text-left",
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
  if (current.key !== key) return { key, direction: key === "asset" || key === "class" ? "asc" : "desc" } as const;
  return { key, direction: current.direction === "asc" ? "desc" : "asc" } as const;
}

function compareHolding(a: HoldingTableRow, b: HoldingTableRow, key: SortKey) {
  if (key === "asset") return a.name.localeCompare(b.name);
  if (key === "class") return a.assetClass.localeCompare(b.assetClass);
  if (key === "quantity") return Number(a.quantity) - Number(b.quantity);
  if (key === "value") return a.currentValue - b.currentValue;
  if (key === "pnl") return a.pnl - b.pnl;
  return new Date(a.updatedIso).getTime() - new Date(b.updatedIso).getTime();
}

function impactTone(value: number) {
  if (value > 0) return { text: "text-emerald-700", row: "border-l-emerald-500/70 bg-emerald-500/[0.03]" };
  if (value < 0) return { text: "text-red-700", row: "border-l-red-500/70 bg-red-500/[0.03]" };
  return { text: "text-muted-foreground", row: "border-l-transparent" };
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[220px] text-right font-medium break-words">{value}</dd>
    </div>
  );
}
