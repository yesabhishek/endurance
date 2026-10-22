import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown, parseBlocks } from "./markdown";

const cite = (ref: string, key: string) => <sup key={key}>{ref}</sup>;
const html = (text: string) => renderToStaticMarkup(<Markdown text={text} cite={cite} />);

describe("answer markdown", () => {
  it("turns source references into citations, including grouped ones", () => {
    const out = html("Value is ₹4.2 lakh [S2], up 3% [S3, S4].");
    expect(out).toContain("<sup>S2</sup>");
    expect(out).toContain("<sup>S3</sup><sup>S4</sup>");
  });

  it("never renders links, images or raw HTML from the model", () => {
    const out = html('See [this site](https://evil.example) ![x](https://evil.example/a.png) <script>alert(1)</script>');
    expect(out).not.toContain("href");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script>");
    expect(out).toContain("this site");
    expect(out).toContain("&lt;script&gt;");
  });

  it("parses tables and right-aligns numeric columns", () => {
    const blocks = parseBlocks("| Stock | Value |\n|---|---:|\n| INFY | ₹1,42,200 |\n| TCS | ₹85,250 |");
    expect(blocks).toEqual([{ kind: "table", head: ["Stock", "Value"], rows: [["INFY", "₹1,42,200"], ["TCS", "₹85,250"]], align: ["left", "right"] }]);
  });

  it("keeps nested lists and bold text", () => {
    const out = html("- **Banks** 29.4%\n  - HDFCBANK\n- IT 12.9%");
    expect(out).toContain("<strong");
    expect(out.match(/<ul/g)).toHaveLength(2);
  });

  it("marks figures for privacy mode, in text and in tables, but never a citation", () => {
    const out = html("Value is ₹4.2 lakh [S2], up 3%.\n\n| Stock | Value |\n|---|---:|\n| INFY | ₹1,42,200 |");
    expect(out).toContain('<span class="sensitive">₹4.2 lakh</span>');
    expect(out).toContain('<span class="sensitive">3%</span>');
    expect(out).toContain('<span class="sensitive">₹1,42,200</span>');
    expect(out).toContain("<sup>S2</sup>");
    expect(out).not.toContain('sensitive">S2');
  });

  it("does not italicise snake_case words", () => {
    expect(html("value_history and list_holdings")).not.toContain("<em>");
  });
});
