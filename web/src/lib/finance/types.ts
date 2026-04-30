import type { EmailKind } from "@prisma/client";

export type ParsedEmail = {
  kind: EmailKind;
  amount: number | null;
  currency: string;
  merchantName: string | null;
  paymentInstrument: string | null;
  category: string | null;
  confidence: number;
  metadata: Record<string, string | number | boolean | null>;
};

export type EmailMessageForParsing = {
  subject: string;
  snippet?: string | null;
  from?: string | null;
  sentAt?: Date | null;
};
