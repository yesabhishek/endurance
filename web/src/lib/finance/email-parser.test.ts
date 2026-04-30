import { describe, expect, it } from "vitest";
import { extractAmount, parseFinancialEmail } from "./email-parser";

describe("email parser", () => {
  it("parses credit card bills", () => {
    const parsed = parseFinancialEmail({
      subject: "Your credit card statement is ready",
      snippet: "Total amount due is INR 42,310.50. Minimum amount due is INR 2,115.",
      from: "HDFC Bank Alerts <alerts@hdfcbank.net>",
    });

    expect(parsed?.kind).toBe("CREDIT_CARD_BILL");
    expect(parsed?.amount).toBe(42310.5);
    expect(parsed?.merchantName).toContain("HDFC Bank");
  });

  it("parses Google Pay UPI payments", () => {
    const parsed = parseFinancialEmail({
      subject: "You paid using Google Pay",
      snippet: "You paid ₹650.00 to BLUE TOKAI COFFEE using UPI.",
      from: "Google Pay <noreply@google.com>",
    });

    expect(parsed?.kind).toBe("UPI_PAYMENT");
    expect(parsed?.amount).toBe(650);
    expect(parsed?.paymentInstrument).toBe("UPI");
    expect(parsed?.category).toBe("Food");
  });

  it("parses subscriptions", () => {
    const parsed = parseFinancialEmail({
      subject: "Your Spotify subscription renewal",
      snippet: "Autopay invoice for Rs. 119 has been paid.",
      from: "Spotify <no-reply@spotify.com>",
    });

    expect(parsed?.kind).toBe("SUBSCRIPTION");
    expect(parsed?.category).toBe("Subscriptions");
  });

  it("parses broker and mutual fund statements", () => {
    const parsed = parseFinancialEmail({
      subject: "Zerodha Coin mutual fund order processed",
      snippet: "Your mutual fund investment of INR 5000 was processed.",
      from: "Zerodha <noreply@zerodha.com>",
    });

    expect(parsed?.kind).toBe("BROKER_STATEMENT");
    expect(parsed?.category).toBe("Investments");
  });

  it("parses gold investment emails", () => {
    const parsed = parseFinancialEmail({
      subject: "Sovereign Gold Bond allotment",
      snippet: "SGB purchase amount INR 12800 has been confirmed.",
      from: "RBI Retail Direct <alerts@rbiretaildirect.org.in>",
    });

    expect(parsed?.kind).toBe("GOLD");
    expect(parsed?.category).toBe("Gold");
  });

  it("extracts rupee amount variants", () => {
    expect(extractAmount("Paid ₹1,234.56")).toBe(1234.56);
    expect(extractAmount("INR 12,000 paid")).toBe(12000);
    expect(extractAmount("950 rs debited")).toBe(950);
  });
});
