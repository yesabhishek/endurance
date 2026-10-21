import type { Prisma } from "@prisma/client";

export function currency(value: number | Prisma.Decimal | null | undefined, compact = false) {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(numberValue);
}

export function numberValue(value: number | Prisma.Decimal | null | undefined) {
  return Number(value ?? 0);
}

export function percentage(value: number | Prisma.Decimal | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

export function shortDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹18,42,350 with Indian digit grouping; `signed` adds + for gains. */
export function inr(value: number | null | undefined, options: { signed?: boolean } = {}) {
  const amount = Number(value ?? 0);
  const text = inrWhole.format(Math.abs(amount));
  if (amount < 0) return `−${text}`;
  return options.signed && amount > 0 ? `+${text}` : text;
}

/** ₹5.78 lakh / ₹1.2 crore for compact displays. */
export function inrShort(value: number | null | undefined) {
  const amount = Math.abs(Number(value ?? 0));
  const sign = Number(value ?? 0) < 0 ? "−" : "";
  if (amount >= 1e7) return `${sign}₹${(amount / 1e7).toFixed(2).replace(/\.?0+$/, "")} crore`;
  if (amount >= 1e5) return `${sign}₹${(amount / 1e5).toFixed(2).replace(/\.?0+$/, "")} lakh`;
  return `${sign}${inrWhole.format(amount)}`;
}

export function pct(value: number | null | undefined, options: { signed?: boolean; digits?: number } = {}) {
  const amount = Number(value ?? 0);
  const text = `${Math.abs(amount).toFixed(options.digits ?? 1)}%`;
  if (amount < 0) return `−${text}`;
  return options.signed && amount > 0 ? `+${text}` : text;
}

/** "9:41 AM today" / "18 Oct, 3:05 PM" in India time. */
export function asOfLabel(value: Date | string | null | undefined) {
  if (!value) return "never";
  const date = new Date(value);
  const zone = "Asia/Kolkata";
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(date);
  if (day(date) === day(new Date())) return `${time} today`;
  const dateText = new Intl.DateTimeFormat("en-IN", { timeZone: zone, day: "numeric", month: "short" }).format(date);
  return `${dateText}, ${time}`;
}

const trimZeros = (text: string) => text.replace(/\.0+$|(\.\d*?)0+$/, "$1");

/** Axis-sized rupees: ₹24.2L, ₹1.35Cr, ₹850K. */
export function inrCompact(value: number) {
  const amount = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (amount >= 1e7) return `${sign}₹${trimZeros((amount / 1e7).toFixed(amount >= 1e9 ? 0 : 2))}Cr`;
  if (amount >= 1e5) return `${sign}₹${trimZeros((amount / 1e5).toFixed(1))}L`;
  if (amount >= 1e3) return `${sign}₹${trimZeros((amount / 1e3).toFixed(0))}K`;
  return `${sign}₹${Math.round(amount)}`;
}
