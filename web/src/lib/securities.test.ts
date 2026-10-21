import { describe, expect, it } from "vitest";
import { parseConstituents, parseCsv } from "./securities";

describe("NSE constituent parsing", () => {
  it("handles quoted fields, commas and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""q"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b, c", 'd "q"'],
      ["1", "2", "3"],
    ]);
  });

  it("maps ISIN to NSE sector and skips bad rows", () => {
    const csv = [
      "﻿Company Name,Industry,Symbol,Series,ISIN Code",
      "HDFC Bank Ltd.,Financial Services,HDFCBANK,EQ,INE040A01034",
      '"Larsen & Toubro Ltd.",Construction,LT,EQ,INE018A01030',
      "Broken Row,,BROKEN,EQ,INE000000000",
      "Not An Isin,Healthcare,XYZ,EQ,12345",
    ].join("\n");
    expect(parseConstituents(csv)).toEqual([
      { isin: "INE040A01034", sector: "Financial Services", symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
      { isin: "INE018A01030", sector: "Construction", symbol: "LT", name: "Larsen & Toubro Ltd." },
    ]);
  });
});
