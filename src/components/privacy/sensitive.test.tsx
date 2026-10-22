import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sensitiveText } from "./sensitive";

/** The text of every figure sensitiveText wrapped. */
const figures = (text: string) => [...renderToStaticMarkup(<>{sensitiveText(text)}</>).matchAll(/<span class="sensitive">(.*?)<\/span>/g)].map((match) => match[1]);

describe("sensitiveText", () => {
  it("wraps money amounts, including lakh and crore", () => {
    expect(figures("You hold ₹18,42,350 across funds, and ₹4.2 lakh in gold or ₹1.2 crore in all.")).toEqual(["₹18,42,350", "₹4.2 lakh", "₹1.2 crore"]);
  });

  it("wraps signed percentages and decimals", () => {
    expect(figures("HDFCBANK is 9.1% of the book, up +0.80% today and −4.9% since bought.")).toEqual(["9.1%", "+0.80%", "−4.9%"]);
  });

  it("wraps grouped and long numbers such as quantities and prices", () => {
    expect(figures("1,800 units at 62.50, then 25000 more.")).toEqual(["1,800", "62.50", "25000"]);
  });

  it("leaves counts, years and dates readable", () => {
    expect(figures("Your top 5 holdings across 3 sectors in 2026, as of 22 Oct.")).toEqual([]);
  });

  it("keeps every character of the text", () => {
    const text = "Value ₹4.2 lakh, up 3% today.";
    expect(renderToStaticMarkup(<>{sensitiveText(text)}</>).replace(/<[^>]+>/g, "")).toBe(text);
  });

  it("escapes markup instead of passing it through", () => {
    const out = renderToStaticMarkup(<>{sensitiveText("<b>₹5</b>")}</>);
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;b&gt;");
  });
});
