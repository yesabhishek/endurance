"use client";

import { getToolName, isToolUIPart } from "ai";
import { Database, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Sensitive, sensitiveText } from "@/components/privacy/sensitive";
import type { ChatMessage } from "@/lib/chats";
import { asOfLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Every tool result carries a `source` block with a reference (S1, S2...). The
// answer cites those references; this panel shows the exact data behind each one.

export type SourceEntry = {
  ref: string;
  title: string;
  origin: string;
  asOf: string | null;
  tool: string;
  input: unknown;
  output: Record<string, unknown>;
};

type SourceBlock = { ref: string; title: string; origin: string; asOf: string | null };

export function collectSources(messages: ChatMessage[]) {
  const map = new Map<string, SourceEntry>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      const output = part.output as { source?: SourceBlock } & Record<string, unknown>;
      if (!output?.source?.ref) continue;
      map.set(output.source.ref, { ...output.source, tool: getToolName(part), input: part.input, output });
    }
  }
  return map;
}

export function CitationChip({ refId, source, active, onSelect }: { refId: string; source: SourceEntry | undefined; active: boolean; onSelect: (ref: string) => void }) {
  const number = refId.replace(/^S/, "");
  if (!source) {
    return (
      <span
        title="This reference doesn't match any data the assistant read. Treat the figure next to it with care."
        className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-dashed border-loss/60 px-1 align-[2px] text-[10.5px] font-medium text-loss tabular-nums"
      >
        {number}?
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(refId)}
      title={`${source.title} · ${source.origin}`}
      aria-label={`Source ${number}: ${source.title}`}
      className={cn(
        "mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border bg-card px-1 align-[2px] text-[10.5px] leading-none font-medium text-muted-foreground tabular-nums transition-colors hover:border-foreground/50 hover:text-foreground",
        active && "border-foreground bg-foreground text-background hover:text-background",
      )}
    >
      {number}
    </button>
  );
}

// --- Rendering raw tool output as something a person can read ----------------

const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function humanize(key: string) {
  const words = key
    .replace(/^pctOf/, "% of ")
    .replace(/PctOf/, " % of ")
    .replace(/Pct(?=[A-Z]|$)/, " %")
    .replace(/Inr$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (/Inr$/.test(key)) return rupee.format(value);
    if (/pct/i.test(key)) return `${value.toFixed(2)}%`;
    return plain.format(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return asOfLabel(value);
    return value;
  }
  return JSON.stringify(value);
}

/** A value as text, with any figure in it marked for privacy mode. */
function renderValue(key: string, value: unknown): ReactNode {
  const text = formatValue(key, value);
  return typeof value === "number" ? <Sensitive>{text}</Sensitive> : sensitiveText(text, key);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function DataView({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  const entries = Object.entries(data).filter(([key, value]) => key !== "source" && value !== undefined);
  const scalars = entries.filter(([, value]) => !isRecord(value) && !Array.isArray(value));
  const nested = entries.filter(([, value]) => isRecord(value) || Array.isArray(value));

  return (
    <div className="flex flex-col gap-3">
      {scalars.length ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[12.5px]">
          {scalars.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{humanize(key)}</dt>
              <dd className={cn("text-right tabular-nums", typeof value === "string" && value.length > 40 && "col-span-2 text-left text-muted-foreground")}>{renderValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {nested.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="text-[11px] font-medium tracking-wide text-faint uppercase">{humanize(key)}</div>
          {Array.isArray(value) ? <ArrayView rows={value} /> : depth < 2 ? <DataView data={value as Record<string, unknown>} depth={depth + 1} /> : null}
        </div>
      ))}
    </div>
  );
}

function ArrayView({ rows }: { rows: unknown[] }) {
  if (!rows.length) return <p className="text-[12.5px] text-muted-foreground">None</p>;
  if (!rows.every(isRecord)) return <p className="text-[12.5px]">{sensitiveText(rows.map((row) => formatValue("", row)).join(", "), "list")}</p>;
  const columns = Object.keys(rows[0] as Record<string, unknown>).slice(0, 8);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[12px] leading-snug">
        <thead>
          <tr className="border-b">
            {columns.map((column) => (
              <th key={column} className="px-1 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground">
                {humanize(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows as Record<string, unknown>[]).map((row, index) => (
            <tr key={index} className="border-b border-border/70 last:border-0">
              {columns.map((column) => (
                <td key={column} className={cn("px-1 py-1.5 align-top", typeof row[column] === "number" ? "text-right whitespace-nowrap tabular-nums" : "")}>
                  {renderValue(column, row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourcesPanel({ sources, selected, onSelect, onClose }: { sources: SourceEntry[]; selected: string | null; onSelect: (ref: string | null) => void; onClose?: () => void }) {
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (selected) itemRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Sources</h2>
          <p className="text-xs text-muted-foreground">The data behind each numbered citation</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close sources" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <ul className="flex-1 overflow-y-auto overscroll-contain">
        {sources.map((source) => {
          const open = source.ref === selected;
          return (
            <li
              key={source.ref}
              ref={(node) => {
                if (node) itemRefs.current.set(source.ref, node);
                else itemRefs.current.delete(source.ref);
              }}
              className="border-b"
            >
              <button type="button" onClick={() => onSelect(open ? null : source.ref)} aria-expanded={open} className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/60", open && "bg-accent/60")}>
                <span className={cn("mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border px-1 text-[11px] font-medium tabular-nums", open ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground")}>
                  {source.ref.replace(/^S/, "")}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-medium">{source.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Database className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{source.origin}</span>
                  </span>
                  {source.asOf ? <span className="text-xs text-faint">As of {asOfLabel(source.asOf)}</span> : null}
                </span>
              </button>
              {open ? (
                <div className="px-5 pt-1 pb-5">
                  <DataView data={source.output} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
