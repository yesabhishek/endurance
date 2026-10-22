"use client";

import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { inr, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Segmented } from "./panel";

export type HoldingRow = {
  key: string;
  label: string;
  name: string;
  assetClass: "STOCK" | "MUTUAL_FUND" | "ETF" | "GOLD";
  sector: string;
  quantity: number;
  averagePrice: number | null;
  lastPrice: number | null;
  value: number;
  weightPct: number;
  pnl: number;
  pnlPct: number | null;
  dayPct: number | null;
};

type SortKey = "label" | "value" | "weightPct" | "pnl" | "pnlPct" | "dayPct";
type Filter = "ALL" | HoldingRow["assetClass"];

const price = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 });

const COLUMNS: Array<{ key: SortKey | null; label: string; align: "left" | "right"; className?: string }> = [
  { key: "label", label: "Instrument", align: "left" },
  { key: null, label: "Qty", align: "right", className: "hidden md:table-cell" },
  { key: null, label: "Avg cost", align: "right", className: "hidden lg:table-cell" },
  { key: null, label: "LTP", align: "right", className: "hidden lg:table-cell" },
  { key: "value", label: "Cur. value", align: "right" },
  { key: "weightPct", label: "Weight", align: "right", className: "hidden sm:table-cell" },
  { key: "pnl", label: "P&L", align: "right" },
  { key: "pnlPct", label: "Net chg.", align: "right", className: "hidden md:table-cell" },
  { key: "dayPct", label: "Day chg.", align: "right", className: "hidden md:table-cell" },
];

/** Every holding, Kite-style columns, sortable and searchable. */
export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "value", desc: true });

  const classes = useMemo(() => new Set(rows.map((row) => row.assetClass)), [rows]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter(
      (row) => (filter === "ALL" || row.assetClass === filter) && (!needle || row.label.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle) || row.sector.toLowerCase().includes(needle)),
    );
    const sign = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => {
      if (sort.key === "label") return sign * a.label.localeCompare(b.label);
      return sign * ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity));
    });
  }, [rows, query, filter, sort]);

  const options: Array<{ value: Filter; label: string }> = [
    { value: "ALL", label: "All" },
    ...(
      [
        ["STOCK", "Stocks"],
        ["MUTUAL_FUND", "Funds"],
        ["ETF", "ETFs"],
        ["GOLD", "Gold"],
      ] as const
    )
      .filter(([value]) => classes.has(value))
      .map(([value, label]) => ({ value, label })),
  ];

  function toggle(key: SortKey) {
    setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: key !== "label" }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Asset class" value={filter} onChange={setFilter} options={options} />
        <label className="flex h-8 w-full items-center gap-2 rounded-md border bg-card px-2.5 text-sm focus-within:border-foreground/40 sm:w-60">
          <Search className="size-3.5 text-faint" aria-hidden />
          <span className="sr-only">Search holdings</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="w-full bg-transparent outline-none placeholder:text-faint" />
        </label>
      </div>
      <div className="-mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-[34rem] text-[13px]">
          <thead>
            <tr className="border-y bg-muted/40">
              {COLUMNS.map((column, index) => (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={column.key && sort.key === column.key ? (sort.desc ? "descending" : "ascending") : undefined}
                  className={cn("h-9 px-3 font-medium whitespace-nowrap text-muted-foreground", column.align === "right" ? "text-right" : "text-left", index === 0 && "pl-5 md:pl-6", index === COLUMNS.length - 1 && "pr-5 md:pr-6", column.className)}
                >
                  {column.key ? (
                    <button type="button" onClick={() => toggle(column.key!)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === column.key && "text-foreground")}>
                      {column.label}
                      {sort.key === column.key ? sort.desc ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden /> : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="border-b last:border-0 hover:bg-muted/30">
                <td className="max-w-[16rem] py-2.5 pr-3 pl-5 md:pl-6">
                  <div className="truncate font-medium" title={row.name}>
                    {row.label}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{row.sector}</div>
                </td>
                <td className="hidden px-3 text-right tabular-nums md:table-cell">{qty.format(row.quantity)}</td>
                <td className="hidden px-3 text-right tabular-nums lg:table-cell">{row.averagePrice === null ? "—" : price.format(row.averagePrice)}</td>
                <td className="hidden px-3 text-right tabular-nums lg:table-cell">{row.lastPrice === null ? "—" : price.format(row.lastPrice)}</td>
                <td className="px-3 text-right tabular-nums">{inr(row.value)}</td>
                <td className="hidden px-3 text-right text-muted-foreground tabular-nums sm:table-cell">{pct(row.weightPct)}</td>
                <td className={cn("px-3 text-right tabular-nums", row.pnl >= 0 ? "text-gain" : "text-loss")}>{inr(row.pnl, { signed: true })}</td>
                <td className={cn("hidden px-3 text-right tabular-nums md:table-cell", (row.pnlPct ?? 0) >= 0 ? "text-gain" : "text-loss")}>{row.pnlPct === null ? "—" : pct(row.pnlPct, { signed: true, digits: 2 })}</td>
                <td className={cn("hidden pr-5 pl-3 text-right tabular-nums md:table-cell md:pr-6", row.dayPct === null ? "text-faint" : row.dayPct >= 0 ? "text-gain" : "text-loss")}>
                  {row.dayPct === null ? "—" : pct(row.dayPct, { signed: true, digits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">No holdings match.</p> : null}
      </div>
    </div>
  );
}
