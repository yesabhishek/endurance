import { Fragment, type ReactNode } from "react";
import { sensitiveText } from "@/components/privacy/sensitive";
import { cn } from "@/lib/utils";

// A small markdown renderer for model answers. It builds React elements directly
// (never HTML strings), renders links as plain text and drops images, so nothing
// in a model's output can inject markup or send you somewhere else.

type CiteRenderer = (ref: string, key: string) => ReactNode;

type ListItem = { text: string; children: ListBlock | null };
type ListBlock = { ordered: boolean; start: number; items: ListItem[] };
type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; list: ListBlock }
  | { kind: "table"; head: string[]; rows: string[][]; align: Array<"left" | "right"> }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "rule" };

const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const NUMERIC = /^[−\-+]?\s*₹?\s*[\d,]+(\.\d+)?\s*(%|x|L|Cr| lakh| crore)?$/i;

function splitRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function startsBlock(line: string, next: string | undefined) {
  return /^#{1,4}\s/.test(line) || /^```/.test(line) || /^\s*>/.test(line) || LIST_ITEM.test(line) || /^(-{3,}|\*{3,})\s*$/.test(line) || (line.includes("|") && next !== undefined && TABLE_DIVIDER.test(next));
}

function parseList(lines: string[]): ListBlock {
  const root: ListBlock = { ordered: false, start: 1, items: [] };
  const stack: Array<{ indent: number; list: ListBlock }> = [];
  for (const line of lines) {
    const match = LIST_ITEM.exec(line);
    if (!match) {
      // Continuation of the previous item's text.
      const top = stack.at(-1)?.list.items.at(-1);
      if (top) top.text += ` ${line.trim()}`;
      continue;
    }
    const indent = match[1].replace(/\t/g, "  ").length;
    const ordered = /\d/.test(match[2]);
    while (stack.length && indent < stack.at(-1)!.indent) stack.pop();
    let current = stack.at(-1);
    if (!current) {
      root.ordered = ordered;
      root.start = ordered ? parseInt(match[2], 10) : 1;
      current = { indent, list: root };
      stack.push(current);
    } else if (indent > current.indent) {
      const parent = current.list.items.at(-1);
      if (parent) {
        parent.children = { ordered, start: ordered ? parseInt(match[2], 10) : 1, items: [] };
        current = { indent, list: parent.children };
        stack.push(current);
      }
    }
    current.list.items.push({ text: match[3], children: null });
  }
  return root;
}

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i += 1;
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].replace(/#+\s*$/, "") });
      i += 1;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i += 1;
      continue;
    }
    if (line.includes("|") && lines[i + 1] !== undefined && TABLE_DIVIDER.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const align = head.map((_, column) => {
        const cells = rows.map((row) => row[column] ?? "").filter((cell) => cell && cell !== "—" && cell !== "-");
        const numeric = cells.filter((cell) => NUMERIC.test(cell.replace(/\*\*|\[S\d+\]/g, "").trim())).length;
        return cells.length > 0 && numeric / cells.length >= 0.6 ? ("right" as const) : ("left" as const);
      });
      blocks.push({ kind: "table", head, rows, align });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() && (LIST_ITEM.test(lines[i]) || /^\s+\S/.test(lines[i]))) body.push(lines[i++]);
      // Lists separated by a single blank line are one list.
      while (i < lines.length && !lines[i].trim() && lines[i + 1] !== undefined && LIST_ITEM.test(lines[i + 1])) {
        i += 1;
        while (i < lines.length && lines[i].trim() && (LIST_ITEM.test(lines[i]) || /^\s+\S/.test(lines[i]))) body.push(lines[i++]);
      }
      blocks.push({ kind: "list", list: parseList(body) });
      continue;
    }
    const body: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) body.push(lines[i++]);
    blocks.push({ kind: "paragraph", text: body.join(" ") });
  }
  return blocks;
}

const INLINE = [
  { kind: "code", re: /`([^`]+)`/ },
  { kind: "cite", re: /\[(S\d+(?:\s*[,;]\s*S\d+)*)\]/ },
  { kind: "link", re: /!?\[([^\]]+)\]\(([^)\s]+)\)/ },
  { kind: "bold", re: /\*\*(.+?)\*\*|__(.+?)__/ },
  { kind: "italic", re: /\*(?!\s)([^*]+?)\*|(?<![\w])_(?!\s)([^_]+?)_(?![\w])/ },
] as const;

export function renderInline(text: string, cite: CiteRenderer, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { kind: (typeof INLINE)[number]["kind"]; match: RegExpExecArray } | null = null;
    for (const { kind, re } of INLINE) {
      const match = re.exec(rest);
      if (match && (!best || match.index < best.match.index)) best = { kind, match };
    }
    // Plain text goes through sensitiveText so privacy mode can blur the figures in an answer.
    if (!best) {
      out.push(...sensitiveText(rest, `${keyPrefix}-e${n}`));
      break;
    }
    const { kind, match } = best;
    if (match.index > 0) out.push(...sensitiveText(rest.slice(0, match.index), `${keyPrefix}-p${n}`));
    const key = `${keyPrefix}-${n++}`;
    if (kind === "code") {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {match[1]}
        </code>,
      );
    } else if (kind === "cite") {
      const refs = match[1].split(/\s*[,;]\s*/);
      out.push(<Fragment key={key}>{refs.map((ref, index) => cite(ref, `${key}-${index}`))}</Fragment>);
    } else if (kind === "link") {
      // Images are dropped; links keep their text but are not clickable.
      if (!match[0].startsWith("!")) out.push(<Fragment key={key}>{renderInline(match[1], cite, key)}</Fragment>);
    } else if (kind === "bold") {
      out.push(
        <strong key={key} className="font-semibold">
          {renderInline(match[1] ?? match[2], cite, key)}
        </strong>,
      );
    } else {
      out.push(<em key={key}>{renderInline(match[1] ?? match[2], cite, key)}</em>);
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

function ListView({ list, cite, depth = 0 }: { list: ListBlock; cite: CiteRenderer; depth?: number }) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag start={list.ordered && list.start !== 1 ? list.start : undefined} className={cn("flex flex-col gap-1.5 pl-5", list.ordered ? "list-decimal" : "list-disc", depth > 0 && "mt-1.5")}>
      {list.items.map((item, index) => (
        <li key={index} className="pl-1 marker:text-faint">
          {renderInline(item.text, cite, `l${depth}-${index}`)}
          {item.children ? <ListView list={item.children} cite={cite} depth={depth + 1} /> : null}
        </li>
      ))}
    </Tag>
  );
}

export function Markdown({ text, cite, className }: { text: string; cite: CiteRenderer; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={cn("flex flex-col gap-3.5 text-[15px] leading-[1.65]", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case "heading":
            return block.level <= 2 ? (
              <h3 key={key} className="font-display mt-2 text-xl leading-snug">
                {renderInline(block.text, cite, key)}
              </h3>
            ) : (
              <h4 key={key} className="mt-1 text-[15px] font-semibold">
                {renderInline(block.text, cite, key)}
              </h4>
            );
          case "paragraph":
            return <p key={key}>{renderInline(block.text, cite, key)}</p>;
          case "list":
            return <ListView key={key} list={block.list} cite={cite} />;
          case "quote":
            return (
              <blockquote key={key} className="border-l-2 border-border pl-4 text-muted-foreground">
                {renderInline(block.text, cite, key)}
              </blockquote>
            );
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[13px] leading-relaxed">
                {block.text}
              </pre>
            );
          case "rule":
            return <hr key={key} className="my-1" />;
          case "table":
            return (
              <div key={key} className="-mx-1 overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px] leading-snug">
                  <thead>
                    <tr className="border-b border-foreground/15">
                      {block.head.map((cell, column) => (
                        <th key={column} className={cn("px-2 py-2 font-medium whitespace-nowrap text-muted-foreground", block.align[column] === "right" ? "text-right" : "text-left")}>
                          {renderInline(cell, cite, `${key}-h${column}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border last:border-0">
                        {block.head.map((_, column) => (
                          <td key={column} className={cn("px-2 py-2 align-top", block.align[column] === "right" && "text-right whitespace-nowrap tabular-nums")}>
                            {renderInline(row[column] ?? "", cite, `${key}-${rowIndex}-${column}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
