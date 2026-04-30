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
