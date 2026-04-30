import type { EmailKind } from "@prisma/client";
import type { EmailMessageForParsing, ParsedEmail } from "./types";

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/netflix|spotify|prime|hotstar|youtube|apple|icloud|subscription/i, "Subscriptions"],
  [/swiggy|zomato|restaurant|food|cafe|coffee/i, "Food"],
  [/uber|ola|rapido|metro|fuel|petrol|diesel/i, "Transport"],
  [/amazon|flipkart|myntra|nykaa|shopping/i, "Shopping"],
  [/electricity|airtel|jio|vi |broadband|gas|water|bill/i, "Bills"],
  [/zerodha|coin|groww|mutual fund|amc|cams|kfin|nse|bse/i, "Investments"],
  [/gold|sgb|sovereign gold|gold bond/i, "Gold"],
];

const FINANCIAL_SIGNAL = /(debited|credited|spent|paid|payment|transaction|statement|bill|autopay|subscription|invoice|upi|google pay|gpay|credit card|mutual fund|gold|zerodha|coin|broker)/i;

export function parseFinancialEmail(message: EmailMessageForParsing): ParsedEmail | null {
  const text = [message.subject, message.snippet, message.from].filter(Boolean).join(" ");

  if (!FINANCIAL_SIGNAL.test(text)) {
    return null;
  }

  const amount = extractAmount(text);
  const kind = inferKind(text);
  const merchantName = inferMerchant(text, message.from);
  const category = inferCategory(text);
  const paymentInstrument = inferInstrument(text);

  return {
    kind,
    amount,
    currency: "INR",
    merchantName,
    paymentInstrument,
    category,
    confidence: confidenceScore({ text, amount, kind, merchantName }),
    metadata: {
      parser: "rule-based-v1",
      matchedAt: new Date().toISOString(),
    },
  };
}

export function extractAmount(text: string) {
  const candidates = [
    /(?:inr|rs\.?|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:inr|rs\.?|₹)/i,
  ];

  for (const regex of candidates) {
    const match = text.match(regex);
    if (match?.[1]) {
      return Number(match[1].replace(/,/g, ""));
    }
  }

  return null;
}

function inferKind(text: string): EmailKind {
  if (/credit card|statement|card bill|amount due|minimum amount/i.test(text)) {
    return "CREDIT_CARD_BILL";
  }
  if (/google pay|gpay|upi|vpa|paid to|debited from/i.test(text)) {
    return "UPI_PAYMENT";
  }
  if (/subscription|autopay|recurring|renewal|invoice/i.test(text)) {
    return "SUBSCRIPTION";
  }
  if (/zerodha|coin|broker|contract note|nse|bse|demat/i.test(text)) {
    return "BROKER_STATEMENT";
  }
  if (/gold|sgb|sovereign gold|gold bond|etf/i.test(text)) {
    return "GOLD";
  }
  if (/bill|electricity|broadband|mobile|postpaid|gas/i.test(text)) {
    return "BILL";
  }
  return "UNKNOWN";
}

function inferMerchant(text: string, from?: string | null) {
  const merchantPatterns = [
    /(?:paid to|payment to|spent at|transaction at|purchase at)\s+([A-Z0-9 &._-]{3,40})/i,
    /(?:merchant|biller)\s*[:\-]\s*([A-Z0-9 &._-]{3,40})/i,
  ];

  for (const regex of merchantPatterns) {
    const match = text.match(regex);
    if (match?.[1]) return cleanName(match[1]);
  }

  if (from) {
    const sender = from.match(/"?([^"<@]+)"?\s*(?:<[^>]+>)?/)?.[1] ?? from;
    return cleanName(sender.replace(/no-?reply|support|alerts|notification/gi, ""));
  }

  return null;
}

function inferCategory(text: string) {
  return CATEGORY_RULES.find(([regex]) => regex.test(text))?.[1] ?? "Uncategorized";
}

function inferInstrument(text: string) {
  const card = text.match(/(?:xx|ending|card)\s*([0-9]{4})/i)?.[1];
  if (card) return `Card ${card}`;
  if (/upi|google pay|gpay/i.test(text)) return "UPI";
  if (/netbanking|bank account/i.test(text)) return "Bank";
  return null;
}

function confidenceScore(input: {
  text: string;
  amount: number | null;
  kind: EmailKind;
  merchantName: string | null;
}) {
  let score = 0.35;
  if (input.amount !== null) score += 0.25;
  if (input.kind !== "UNKNOWN") score += 0.2;
  if (input.merchantName) score += 0.1;
  if (/transaction|payment|statement|invoice|debited|credited/i.test(input.text)) score += 0.1;
  return Math.min(Number(score.toFixed(2)), 0.95);
}

function cleanName(value: string) {
  return value.replace(/\s+/g, " ").replace(/[|:;,.]+$/g, "").trim().slice(0, 80) || null;
}
